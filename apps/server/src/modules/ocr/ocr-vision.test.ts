import { describe, expect, it } from 'vitest';
import { imageDataUrl, mimeForImage, OCR_VISION_PROMPT } from './ocr-vision';

describe('mimeForImage', () => {
  it('maps known extensions (case-insensitive)', () => {
    expect(mimeForImage('/a/b.png')).toBe('image/png');
    expect(mimeForImage('/a/b.JPG')).toBe('image/jpeg');
    expect(mimeForImage('scan.jpeg')).toBe('image/jpeg');
    expect(mimeForImage('x.webp')).toBe('image/webp');
    expect(mimeForImage('x.tiff')).toBe('image/tiff');
  });

  it('defaults unknown/extensionless to image/png', () => {
    expect(mimeForImage('/a/b.heic')).toBe('image/png');
    expect(mimeForImage('noext')).toBe('image/png');
  });
});

describe('imageDataUrl', () => {
  it('builds a data URL with the derived mime and the base64 payload', () => {
    expect(imageDataUrl('a.jpg', 'AAAA')).toBe('data:image/jpeg;base64,AAAA');
  });
});

describe('OCR_VISION_PROMPT', () => {
  it('instructs a verbatim, commentary-free transcription', () => {
    expect(OCR_VISION_PROMPT.toLowerCase()).toContain('transcribe');
    expect(OCR_VISION_PROMPT.toLowerCase()).toContain('only');
  });
});
