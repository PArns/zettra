import { readFile } from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import { cleanOcrText } from '@zettra/shared';

/**
 * PDF text extraction (§5/§6): pull the embedded text layer out of an uploaded PDF so its content
 * feeds hybrid search and deadline detection — the document analogue of the OCR pass. Uses `unpdf`
 * (pdf.js under the hood, no native deps). Scanned/image-only PDFs have no text layer and yield
 * nothing here; OCR would be the fallback. Degrades to empty on any failure — never fails the job.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async extractText(path: string): Promise<string> {
    try {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const buffer = await readFile(path);
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(pdf, { mergePages: true });
      return cleanOcrText(Array.isArray(text) ? text.join('\n') : text);
    } catch (err) {
      this.logger.warn(`PDF text extraction failed for ${path}: ${(err as Error).message}`);
      return '';
    }
  }
}
