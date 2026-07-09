import { extname } from 'node:path';

/**
 * Pure helpers for the Ollama vision-model OCR backend (§5/§6). Kept separate from the service so
 * the prompt and MIME mapping are unit-testable without the network/filesystem.
 */

/** Instruction sent to the vision model: transcribe verbatim, nothing else. */
export const OCR_VISION_PROMPT =
  'Transcribe all text visible in this image exactly, preserving line breaks. ' +
  'Output only the transcribed text — no commentary, no description, no markdown fences. ' +
  'If there is no text, output nothing.';

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
};

/** MIME type for an image path, for building a `data:` URL (defaults to image/png). */
export function mimeForImage(path: string): string {
  return IMAGE_MIME[extname(path).toLowerCase()] ?? 'image/png';
}

/** A `data:` URL embedding the base64 image bytes for an OpenAI-compatible vision request. */
export function imageDataUrl(path: string, base64: string): string {
  return `data:${mimeForImage(path)};base64,${base64}`;
}
