import { readFile } from 'node:fs/promises';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { cleanOcrText } from '@zettra/shared';
import { loadConfig } from '../../config/configuration';
import { imageDataUrl, OCR_VISION_PROMPT } from './ocr-vision';

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
 * Two backends, selected by `OCR_BACKEND` (default `tesseract`):
 *  - `tesseract`: tesseract.js, an OPTIONAL dependency loaded lazily only when `OCR_ENABLED=true`.
 *  - `ollama`: a vision model (`OCR_VISION_MODEL`) over Ollama's OpenAI-compatible endpoint —
 *    better on handwriting/layout, no extra Node dependency.
 * Either way the service degrades to returning no text (never failing the embed job) if the flag
 * is off, the dependency/model is absent, or recognition errors.
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
    if (this.cfg.ocrBackend === 'ollama') return this.recognizeWithOllama(imagePath);
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

  /** Vision-model OCR via Ollama's OpenAI-compatible endpoint. Empty on any failure. */
  private async recognizeWithOllama(imagePath: string): Promise<string> {
    try {
      const base64 = (await readFile(imagePath)).toString('base64');
      const res = await fetch(`${this.cfg.ollamaUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.cfg.ocrVisionModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: OCR_VISION_PROMPT },
                { type: 'image_url', image_url: { url: imageDataUrl(imagePath, base64) } },
              ],
            },
          ],
          keep_alive: '30m',
        }),
      });
      if (!res.ok) throw new Error(`Ollama vision OCR failed: ${res.status}`);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return cleanOcrText(json.choices?.[0]?.message?.content ?? '');
    } catch (err) {
      this.logger.warn(`Ollama OCR failed for ${imagePath}: ${(err as Error).message}`);
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
