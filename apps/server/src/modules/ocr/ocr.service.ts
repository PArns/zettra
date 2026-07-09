import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { cleanOcrText } from '@zettra/shared';
import { loadConfig } from '../../config/configuration';

/** Minimal shape of the tesseract.js worker we rely on (kept local so the dep stays optional). */
interface TesseractWorker {
  recognize(image: string): Promise<{ data: { text: string } }>;
  terminate(): Promise<unknown>;
}
type TesseractModule = {
  createWorker(langs?: string): Promise<TesseractWorker>;
};

/**
 * OCR pass (§5/§6): recognize text in uploaded raster images so it feeds hybrid search and
 * deadline detection (a "Termin" written in a scanned letter becomes findable + reminder-able).
 *
 * tesseract.js is an OPTIONAL dependency loaded lazily only when `OCR_ENABLED=true`. If the flag
 * is off, or the package/language data is absent, the service degrades to returning no text rather
 * than failing the embed job — the seam is ready and an operator turns it on by installing
 * tesseract.js and setting the flag. SPEC-GAP: a vision-model backend (Ollama) as an alternative.
 */
@Injectable()
export class OcrService implements OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private readonly cfg = loadConfig();
  private workerPromise: Promise<TesseractWorker | null> | null = null;

  get enabled(): boolean {
    return this.cfg.ocrEnabled;
  }

  /** Recognize + normalize the text in an image file (path or data URL). Empty on any failure. */
  async recognize(imagePath: string): Promise<string> {
    if (!this.enabled) return '';
    const worker = await this.getWorker();
    if (!worker) return '';
    try {
      const { data } = await worker.recognize(imagePath);
      return cleanOcrText(data.text ?? '');
    } catch (err) {
      this.logger.warn(`OCR failed for ${imagePath}: ${(err as Error).message}`);
      return '';
    }
  }

  /** Lazily create (and memoize) the tesseract worker; null if the optional dep is unavailable. */
  private getWorker(): Promise<TesseractWorker | null> {
    if (!this.workerPromise) {
      this.workerPromise = this.createWorker();
    }
    return this.workerPromise;
  }

  private async createWorker(): Promise<TesseractWorker | null> {
    try {
      // Computed specifier so a missing optional dependency is a runtime skip, not a build error.
      const moduleName = 'tesseract.js';
      const mod = (await import(/* @vite-ignore */ moduleName)) as unknown as TesseractModule;
      const worker = await mod.createWorker(this.cfg.ocrLanguages);
      this.logger.log(`OCR enabled (langs=${this.cfg.ocrLanguages})`);
      return worker;
    } catch (err) {
      this.logger.warn(
        `OCR_ENABLED but tesseract.js is unavailable — OCR disabled: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    const worker = await this.workerPromise?.catch(() => null);
    await worker?.terminate().catch(() => undefined);
  }
}
