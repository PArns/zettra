import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { BlockSource } from '@zettra/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Ctx } from '../../common/current-context.decorator';
import { RequestContext } from '../../common/request-context';
import { UploadsService } from './uploads.service';
import { BlockService } from '../block/block.service';
import { LimitsService } from '../limits/limits.service';

/**
 * Upload + file serving (§8.3). `POST /uploads` backs BlockNote's `uploadFile` (inline image
 * upload). `POST /uploads/capture` creates an upload-source block that lands in the
 * Briefkasten. `GET /files/:tenantId/:name` serves stored files (public, unguessable key).
 */
@Controller()
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    private readonly blocks: BlockService,
    private readonly limits: LimitsService,
  ) {}

  @Post('uploads')
  @UseGuards(AuthGuard)
  async upload(@Ctx() ctx: RequestContext, @Req() req: FastifyRequest): Promise<{ url: string }> {
    await this.limits.assertCanUpload(ctx.tenantId, contentLength(req));
    const file = await (
      req as FastifyRequest & { file: () => Promise<MultipartFile | undefined> }
    ).file();
    if (!file) throw new BadRequestException('No file provided');
    const { url } = await this.uploads.save(ctx.tenantId, file.filename, file.file);
    return { url };
  }

  @Post('uploads/capture')
  @UseGuards(AuthGuard)
  async capture(
    @Ctx() ctx: RequestContext,
    @Req() req: FastifyRequest,
  ): Promise<{ url: string; blockId: string }> {
    await this.limits.assertCanUpload(ctx.tenantId, contentLength(req));
    const file = await (
      req as FastifyRequest & { file: () => Promise<MultipartFile | undefined> }
    ).file();
    if (!file) throw new BadRequestException('No file provided');
    const spaceId = ctx.visibleSpaceIds[0];
    if (!spaceId) throw new BadRequestException('No space available');
    const { url, key } = await this.uploads.save(ctx.tenantId, file.filename, file.file);
    // Create an upload-source block in the Briefkasten with the file embedded (§8.3).
    const block = await this.blocks.create(ctx, {
      spaceId,
      source: BlockSource.Upload,
      sourceRef: key,
      content: uploadDocument(file.filename, url),
    });
    return { url, blockId: block.id };
  }

  @Get('files/:tenantId/:name')
  async serve(
    @Param('tenantId') tenantId: string,
    @Param('name') name: string,
    @Query('sig') sig: string | undefined,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const key = `${tenantId}/${basename(name)}`;
    this.uploads.verify(key, sig); // Reject tampered/unsigned URLs (§8.3).
    const full = await this.uploads.resolve(key);
    res.header('cache-control', 'private, max-age=86400');
    res.send(createReadStream(full));
  }
}

/** Best-effort incoming body size from Content-Length (multipart overhead over-counts slightly,
 * which is safe for a cap check); 0 when the header is absent or unparseable. */
function contentLength(req: FastifyRequest): number {
  const raw = req.headers['content-length'];
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Minimal BlockNote document embedding an uploaded image/file. */
function uploadDocument(filename: string, url: string): unknown {
  const isImage = /\.(png|jpe?g|gif|webp|svg)$/i.test(filename);
  return [
    isImage
      ? { type: 'image', props: { url, caption: filename } }
      : { type: 'file', props: { url, name: filename } },
  ];
}

interface MultipartFile {
  filename: string;
  file: NodeJS.ReadableStream;
}
