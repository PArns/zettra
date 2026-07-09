import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { loadConfig } from '../../config/configuration';

/**
 * Stores uploaded files on a mounted volume (§8.3 upload source). Files live under
 * `<uploadDir>/<tenantId>/<uuid.ext>` and are served back by an unguessable, HMAC-signed key.
 * Serving carries no per-request auth header because <img src> cannot send one; instead the key
 * is a random UUID and the served URL carries a tamper-proof `?sig=` (see `sign`/`verify`).
 */
@Injectable()
export class UploadsService {
  private readonly root = loadConfig().uploadDir;
  private readonly secret = loadConfig().appSecret;

  private readonly allowed = new Set([
    // images
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.avif',
    '.heic',
    '.bmp',
    '.tiff',
    // docs / data
    '.pdf',
    '.txt',
    '.md',
    '.csv',
    '.json',
    '.docx',
    '.xlsx',
    '.pptx',
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
    // Sign the key so served URLs are tamper-proof, not merely unguessable (§8.3).
    return { key, url: `/api/files/${key}?sig=${this.sign(key)}` };
  }

  /** HMAC-SHA256 of the file key, base64url. Embedded in the served URL as `?sig=`. */
  sign(key: string): string {
    return createHmac('sha256', this.secret).update(key).digest('base64url');
  }

  verify(key: string, sig: string | undefined): void {
    const expected = Buffer.from(this.sign(key));
    const given = Buffer.from(sig ?? '');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw new ForbiddenException('Invalid file signature');
    }
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
