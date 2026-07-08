import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
import { CreateTagFieldDto } from '@zettra/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { TagService, EffectiveField } from './tag.service';
import { Tag } from '../../entities/index';

class CreateTagBody {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsString() extendsId?: string;
  @IsOptional() @IsArray() fields?: CreateTagFieldDto[];
}

@Controller('tags')
@UseGuards(AuthGuard)
export class TagController {
  constructor(private readonly tags: TagService) {}

  @Get()
  list(@Ctx() ctx: RequestContext): Promise<Tag[]> {
    return this.tags.list(ctx.tenantId);
  }

  @Post()
  create(@Ctx() ctx: RequestContext, @Body() body: CreateTagBody): Promise<Tag> {
    return this.tags.create(ctx.tenantId, body);
  }

  @Get(':id/fields')
  fields(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<EffectiveField[]> {
    return this.tags.resolveEffectiveFields(ctx.tenantId, id);
  }

  @Post(':id/apply/:blockId')
  apply(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Param('blockId') blockId: string,
  ): Promise<unknown> {
    return this.tags.applyTag(ctx.tenantId, blockId, id, ctx.userId);
  }

  @Delete(':id/apply/:blockId')
  async remove(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Param('blockId') blockId: string,
  ): Promise<{ ok: true }> {
    await this.tags.removeTag(ctx.tenantId, blockId, id);
    return { ok: true };
  }
}
