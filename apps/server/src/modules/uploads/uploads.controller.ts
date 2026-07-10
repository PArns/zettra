import { createReadStream } from 'node:fs';
import { basename, extname } from 'node:path';
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
import { BlockSource, csvToTableDoc } from '@zettra/shared';
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

    // A dropped CSV becomes an editable table block rather than a stored file (§4).
    if (extname(file.filename).toLowerCase() === '.csv') {
      const chunks: Buffer[] = [];
      for await (const chunk of file.file) chunks.push(chunk as Buffer);
      const text = Buffer.concat(chunks).toString('utf8');
      const block = await this.blocks.create(ctx, {
        spaceId,
        source: BlockSource.Upload,
        content: csvToTableDoc(text) as unknown as Record<string, unknown>[],
      });
      return { url: '', blockId: block.id };
    }

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
    // Set a content-type from the extension so images render inline and PDFs preview instead of
    // downloading as octet-stream (Fastify sends streams as octet-stream by default).
    res.header('content-type', mimeFor(name));
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

/** Map a file extension to a MIME type for inline serving; unknown → octet-stream. */
function mimeFor(name: string): string {
  const ext = extname(name).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.csv': 'text/csv; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json',
  };
  return map[ext] ?? 'application/octet-stream';
}

/** Minimal BlockNote document embedding an uploaded image / PDF / file. */
function uploadDocument(filename: string, url: string): unknown {
  if (/\.(png|jpe?g|gif|webp|svg)$/i.test(filename)) {
    return [{ type: 'image', props: { url, caption: filename } }];
  }
  // PDFs get the custom `pdf` block so they preview inline (browser viewer) + are text-extracted.
  if (/\.pdf$/i.test(filename)) {
    return [{ type: 'pdf', props: { url, name: filename } }];
  }
  return [{ type: 'file', props: { url, name: filename } }];
}

interface MultipartFile {
  filename: string;
  file: NodeJS.ReadableStream;
}
