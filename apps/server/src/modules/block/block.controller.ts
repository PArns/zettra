import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Allow, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { BlockDto, BlockSource, BlockVisibility } from '@zettra/shared';
import { BlockService } from './block.service';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { toBlockDto } from '../../common/block-dto';

class CreateBlockBody {
  @IsUUID() spaceId!: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @Allow() content?: unknown;
  /** Non-manual source (upload/voice/web_clip) runs the capture pipeline → auto-tag (§8.3). */
  @IsOptional() @IsEnum(BlockSource) source?: BlockSource;
  @IsOptional() @IsString() sourceRef?: string;
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
      source: body.source,
      sourceRef: body.sourceRef ?? null,
    });
    return toBlockDto(block, await this.blocks.tagIdsFor(block.id));
  }

  @Get(':id')
  async get(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<BlockDto> {
    const block = await this.blocks.get(ctx, id);
    return toBlockDto(block, await this.blocks.tagIdsFor(id));
  }

  @Get()
  async list(@Ctx() ctx: RequestContext, @Query('spaceId') spaceId: string): Promise<BlockDto[]> {
    const blocks = await this.blocks.listInSpace(ctx, spaceId);
    const tags = await this.blocks.tagIdsForMany(blocks.map((b) => b.id));
    return blocks.map((b) => toBlockDto(b, tags.get(b.id) ?? []));
  }

  @Put(':id/content')
  async updateContent(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateContentBody,
  ): Promise<BlockDto> {
    const block = await this.blocks.updateContent(ctx, id, body.content);
    return toBlockDto(block, await this.blocks.tagIdsFor(id));
  }

  @Put(':id/visibility')
  async setVisibility(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: SetVisibilityBody,
  ): Promise<BlockDto> {
    const block = await this.blocks.setVisibility(ctx, id, body.visibility);
    return toBlockDto(block, await this.blocks.tagIdsFor(id));
  }

  /** Clear the "For Review" flag once a capture has been triaged (§8.3). */
  @Post(':id/reviewed')
  async markReviewed(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<BlockDto> {
    const block = await this.blocks.markReviewed(ctx, id);
    return toBlockDto(block, await this.blocks.tagIdsFor(id));
  }
}
