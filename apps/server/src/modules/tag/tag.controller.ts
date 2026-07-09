import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CreateTagFieldDto, FieldType } from '@zettra/shared';
import { TagField } from '../../entities/index';
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
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsArray() fields?: CreateTagFieldDto[];
}

class TagFieldBody {
  @IsString() @MinLength(1) name!: string;
  @IsEnum(FieldType) type!: FieldType;
  @IsOptional() config?: Record<string, unknown>;
  @IsOptional() position?: number;
}

/** Partial patch for schema evolution — every property is optional and independently validated. */
class UpdateTagFieldBody {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsEnum(FieldType) type?: FieldType;
  @IsOptional() config?: Record<string, unknown>;
  @IsOptional() position?: number;
}

class SetParentBody {
  @IsOptional() @IsString() parentId?: string | null;
}

class UpdateTagBody {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() icon?: string | null;
  @IsOptional() @IsString() color?: string | null;
  @IsOptional() @IsString() extendsId?: string | null;
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

  @Patch(':id')
  update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: UpdateTagBody,
  ): Promise<Tag> {
    return this.tags.update(ctx.tenantId, id, body);
  }

  @Get(':id/fields')
  fields(@Ctx() ctx: RequestContext, @Param('id') id: string): Promise<EffectiveField[]> {
    return this.tags.resolveEffectiveFields(ctx.tenantId, id);
  }

  // --- Schema evolution (§8.1, §11) ---

  @Post(':id/fields')
  addField(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: TagFieldBody,
  ): Promise<TagField> {
    return this.tags.addField(ctx.tenantId, id, body);
  }

  @Patch('fields/:fieldId')
  updateField(
    @Ctx() ctx: RequestContext,
    @Param('fieldId') fieldId: string,
    @Body() body: UpdateTagFieldBody,
  ): Promise<TagField> {
    return this.tags.updateField(ctx.tenantId, fieldId, body);
  }

  @Delete('fields/:fieldId')
  async removeField(
    @Ctx() ctx: RequestContext,
    @Param('fieldId') fieldId: string,
  ): Promise<{ ok: true }> {
    await this.tags.removeField(ctx.tenantId, fieldId);
    return { ok: true };
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

  /** Move a tag under a new folder parent (or to the root with `parentId: null`). */
  @Patch(':id/parent')
  setParent(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: SetParentBody,
  ): Promise<Tag> {
    return this.tags.setParent(ctx.tenantId, id, body.parentId ?? null);
  }
}
