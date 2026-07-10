/**
 * Pure helpers for the OCR pass (§5/§6). Given a settled document, find the image attachments
 * worth running text recognition on, and normalize the recognized text before it is folded into
 * `searchText`. The actual recognition (tesseract / a vision model) is a server-side seam; these
 * deterministic helpers are unit-tested so the extraction + cleanup rules are pinned down.
 */

import type { DocBlock, InlineNode } from './editor';

/** Image extensions we attempt OCR on. Vectors (svg) and documents (pdf) are excluded. */
const OCR_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff']);

/** Whether a filename / URL points at a raster image worth OCR-ing. */
export function shouldOcr(urlOrName: string): boolean {
  const clean = urlOrName.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  if (dot < 0) return false;
  return OCR_EXTENSIONS.has(clean.slice(dot + 1).toLowerCase());
}

/**
 * Collect distinct image URLs from a document tree (BlockNote `image`/`file` blocks carry the
 * source in `props.url`). Only raster images (per {@link shouldOcr}) are returned, in document
 * order, deduped.
 */
export function extractImageUrls(doc: DocBlock[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const visitBlocks = (blocks: DocBlock[] | undefined): void => {
    for (const block of blocks ?? []) {
      const url = block.props?.url;
      if (typeof url === 'string' && shouldOcr(url) && !seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
      // Some editors nest the image node inline (e.g. within content); scan those too.
      visitInline(block.content);
      visitBlocks(block.children);
    }
  };
  const visitInline = (nodes: InlineNode[] | undefined): void => {
    for (const node of nodes ?? []) {
      const url = node.props?.url;
      if (typeof url === 'string' && shouldOcr(url) && !seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
      visitInline(node.content);
    }
  };
  visitBlocks(doc);
  return urls;
}

/** Whether a filename / URL points at a PDF (whose embedded text we extract for search, §11). */
export function isPdf(urlOrName: string): boolean {
  const clean = urlOrName.split('?')[0].split('#')[0];
  return clean.slice(clean.lastIndexOf('.') + 1).toLowerCase() === 'pdf';
}

/** Collect distinct PDF URLs from a document tree (BlockNote `file`/`pdf` blocks carry `props.url`). */
export function extractPdfUrls(doc: DocBlock[]): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const visit = (blocks: DocBlock[] | undefined): void => {
    for (const block of blocks ?? []) {
      const url = block.props?.url;
      if (typeof url === 'string' && isPdf(url) && !seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
      visit(block.children);
    }
  };
  visit(doc);
  return urls;
}

/**
 * Normalize raw OCR output: collapse runs of whitespace, drop lines that are pure noise (no
 * alphanumerics), and trim. Keeps line breaks between surviving lines so structure is preserved.
 */
export function cleanOcrText(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line) => line.length > 0 && /[\p{L}\p{N}]/u.test(line))
    .join('\n')
    .trim();
}

/** Fold OCR-extracted text into a block's base search text (§11), skipping empties. */
export function mergeSearchText(base: string, ocrTexts: string[]): string {
  return [base, ...ocrTexts]
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .join('\n\n');
}
