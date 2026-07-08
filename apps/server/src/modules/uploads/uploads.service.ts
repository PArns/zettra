import { randomUUID } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { loadConfig } from '../../config/configuration';

/**
 * Stores uploaded files on a mounted volume (§8.3 upload source). Files live under
 * `<uploadDir>/<tenantId>/<uuid.ext>` and are served back by an unguessable key. v1 serves
 * without per-request auth because <img src> cannot send an Authorization header; keys are
 * random UUIDs. SPEC-GAP: signed URLs / access-scoped downloads.
 */
@Injectable()
export class UploadsService {
  private readonly root = loadConfig().uploadDir;

  private readonly allowed = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.pdf',
    '.txt',
    '.md',
  ]);

  /** Persist a stream to disk, returning the public key + url. */
  async save(
    tenantId: string,
    filename: string,
    data: NodeJS.ReadableStream,
  ): Promise<{ key: string; url: string }> {
    const ext = extname(filename).toLowerCase();
    if (ext && !this.allowed.has(ext)) {
      throw new BadRequestException(`Unsupported file type: ${ext}`);
    }
    const dir = join(this.root, tenantId);
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}${ext}`;
    const key = `${tenantId}/${name}`;
    await pipeline(data, createWriteStream(join(dir, name)));
    return { key, url: `/api/files/${key}` };
  }

  /** Resolve a stored file path, guarding against path traversal. */
  async resolve(key: string): Promise<string> {
    const clean = normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    if (clean.includes('..')) throw new BadRequestException('Invalid path');
    const full = join(this.root, clean);
    if (!full.startsWith(normalize(this.root)) || !existsSync(full)) {
      throw new NotFoundException('File not found');
    }
    await stat(full);
    return full;
  }
}
