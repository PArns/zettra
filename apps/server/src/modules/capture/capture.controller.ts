import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { BlockDto, BlockSource } from '@zettra/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { Block } from '../../entities/index';
import { BlockService } from '../block/block.service';
import { toBlockDto } from '../../common/block-dto';

class CaptureBody {
  @IsString() @MinLength(1) text!: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsEnum(BlockSource) source?: BlockSource;
  /** External identity for idempotency (§8.3): IMAP message-id, URL, file path. */
  @IsOptional() @IsString() sourceRef?: string;
}

/**
 * Generic capture entry point (§8.3). Backs the web clipper, quick text capture, and — with
 * `source: 'email'` + a message-id `sourceRef` — an IMAP poller. Idempotent per
 * (tenantId, sourceRef): re-capturing the same URL/email returns the existing block. Creating
 * the block enqueues `process-capture` (tag/field proposal + mention linking).
 */
@Controller('capture')
@UseGuards(AuthGuard)
export class CaptureController {
  constructor(
    @InjectRepository(Block) private readonly blocks: Repository<Block>,
    private readonly blockService: BlockService,
  ) {}

  @Post()
  async capture(@Ctx() ctx: RequestContext, @Body() body: CaptureBody): Promise<BlockDto> {
    const spaceId = ctx.visibleSpaceIds[0];
    if (!spaceId) throw new BadRequestException('No space available');

    const sourceRef = body.sourceRef ?? body.url ?? null;
    if (sourceRef) {
      const existing = await this.blocks.findOne({ where: { tenantId: ctx.tenantId, sourceRef } });
      if (existing) return toBlockDto(existing, await this.blockService.tagIdsFor(existing.id)); // Idempotent (§8.3).
    }

    const content = captureDocument(body.title, body.text, body.url);
    const block = await this.blockService.create(ctx, {
      spaceId,
      source: body.source ?? BlockSource.WebClip,
      sourceRef,
      content,
    });
    return toBlockDto(block, await this.blockService.tagIdsFor(block.id));
  }
}

/** A BlockNote document from captured text: an optional heading then paragraphs. */
function captureDocument(title: string | undefined, text: string, url?: string): unknown {
  const blocks: unknown[] = [];
  if (title) blocks.push({ type: 'heading', content: [{ type: 'text', text: title, styles: {} }] });
  for (const line of text.split(/\n{2,}/)) {
    blocks.push({ type: 'paragraph', content: [{ type: 'text', text: line.trim(), styles: {} }] });
  }
  if (url) {
    blocks.push({
      type: 'paragraph',
      content: [{ type: 'link', href: url, content: [{ type: 'text', text: url, styles: {} }] }],
    });
  }
  return blocks;
}
