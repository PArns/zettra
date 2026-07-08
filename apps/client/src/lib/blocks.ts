import { extractPlainText, type DocBlock } from '@zettra/shared';
import type { BlockDto } from '@zettra/shared';

function toDoc(content: unknown): DocBlock[] {
  return Array.isArray(content) ? (content as DocBlock[]) : [];
}

/** A human title for a block: first line of its text, or a fallback. */
export function blockTitle(block: BlockDto): string {
  const text = extractPlainText(toDoc(block.content)).trim();
  if (!text) return 'Untitled';
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function blockPreview(block: BlockDto): string {
  return extractPlainText(toDoc(block.content)).slice(0, 200);
}
