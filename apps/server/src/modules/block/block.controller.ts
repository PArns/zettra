import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Allow, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { BlockDto, BlockVisibility } from '@zettra/shared';
import { BlockService } from './block.service';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { Block } from '../../entities/index';

class CreateBlockBody {
  @IsUUID() spaceId!: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @Allow() content?: unknown;
}

class UpdateContentBody {
  @Allow() content!: unknown;
}

class SetVisibilityBody {
  @IsEnum(BlockVisibility) visibility!: BlockVisibility;
}

@Controller('blocks')
@UseGuards(AuthGuard)
export class BlockController {
  constructor(private readonly blocks: BlockService) {}

  @Post()
  async create(@Ctx() ctx: RequestContext, @Body() body: CreateBlockBody): Promise<BlockDto> {
    const block = await this.blocks.create(ctx, {
      spaceId: body.spaceId,
      parentId: body.parentId ?? null,
      content: body.content,
    });
    return this.toDto(block, await this.blocks.tagIdsFor(block.id));
  }

  @Get(':id')
  async get(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<BlockDto> {
    const block = await this.blocks.get(ctx, id);
    return this.toDto(block, await this.blocks.tagIdsFor(id));
  }

  @Get()
  async list(@Ctx() ctx: RequestContext, @Query('spaceId') spaceId: string): Promise<BlockDto[]> {
    const blocks = await this.blocks.listInSpace(ctx, spaceId);
    return Promise.all(blocks.map(async (b) => this.toDto(b, await this.blocks.tagIdsFor(b.id))));
  }

  @Put(':id/content')
  async updateContent(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateContentBody,
  ): Promise<BlockDto> {
    const block = await this.blocks.updateContent(ctx, id, body.content);
    return this.toDto(block, await this.blocks.tagIdsFor(id));
  }

  @Put(':id/visibility')
  async setVisibility(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: SetVisibilityBody,
  ): Promise<BlockDto> {
    const block = await this.blocks.setVisibility(ctx, id, body.visibility);
    return this.toDto(block, await this.blocks.tagIdsFor(id));
  }

  private toDto(b: Block, tagIds: string[]): BlockDto {
    return {
      id: b.id,
      tenantId: b.tenantId,
      spaceId: b.spaceId,
      parentId: b.parentId,
      position: b.position,
      content: b.content,
      source: b.source,
      sourceRef: b.sourceRef,
      visibility: b.visibility,
      ownerUserId: b.ownerUserId,
      createdBy: b.createdBy,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      tagIds,
    };
  }
}
