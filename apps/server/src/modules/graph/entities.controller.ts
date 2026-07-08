import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { AliasIndexService, AliasEntry } from '../linking/alias-index.service';
import { BlockService } from '../block/block.service';
import { TagService } from '../tag/tag.service';

class CreateEntityBody {
  @IsString() @MinLength(1) name!: string;
  @IsOptional() @IsUUID() spaceId?: string;
  @IsOptional() @IsString() tagName?: string;
}

/**
 * Backs the editor's `#`/`[[`/`@` suggestion menus (§8.6): permission-scoped fuzzy search of
 * known entities, plus create-if-not-exists (create the target block server-side, return its
 * id so the client inserts the reference node).
 */
@Controller('entities')
@UseGuards(AuthGuard)
export class EntitiesController {
  constructor(
    private readonly alias: AliasIndexService,
    private readonly blocks: BlockService,
    private readonly tags: TagService,
  ) {}

  @Get('search')
  search(@Ctx() ctx: RequestContext, @Query('q') q: string): Promise<AliasEntry[]> {
    return this.alias.search(ctx.tenantId, ctx.visibleSpaceIds, q ?? '');
  }

  @Post()
  async create(
    @Ctx() ctx: RequestContext,
    @Body() body: CreateEntityBody,
  ): Promise<{ blockId: string; label: string }> {
    const spaceId = body.spaceId ?? ctx.visibleSpaceIds[0];
    if (!spaceId) throw new Error('No space available');
    const block = await this.blocks.create(ctx, {
      spaceId,
      content: [{ type: 'heading', content: [{ type: 'text', text: body.name }] }],
    });
    if (body.tagName) {
      const tag = (await this.tags.list(ctx.tenantId)).find((t) => t.name === body.tagName);
      if (tag) await this.tags.applyTag(ctx.tenantId, block.id, tag.id, ctx.userId);
    }
    return { blockId: block.id, label: body.name };
  }
}
