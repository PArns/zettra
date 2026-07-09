import { describe, expect, it } from 'vitest';
import { OcrService } from './ocr.service';

// OCR is off by default (OCR_ENABLED unset), so the service must degrade to no text and never
// attempt to load the optional tesseract.js dependency.
const svc = new OcrService();

describe('OcrService (disabled by default)', () => {
  it('reports disabled', () => {
    expect(svc.enabled).toBe(false);
  });

  it('recognize returns empty text without touching the OCR engine', async () => {
    await expect(svc.recognize('/data/uploads/t/x.png')).resolves.toBe('');
  });
});
