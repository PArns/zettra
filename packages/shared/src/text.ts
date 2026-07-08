import { DocBlock, InlineNode } from './editor';

/**
 * Extract plaintext from a settled document (§8.4: "plaintext extracted from content").
 * Used to build embeddings and to feed capture/curation prompts. Reference/tag nodes
 * contribute their display label.
 */
export function extractPlainText(blocks: DocBlock[]): string {
  const parts: string[] = [];
  const visitInline = (nodes: InlineNode[] = []): void => {
    for (const n of nodes) {
      if (typeof n.text === 'string') parts.push(n.text);
      else if (n.props?.label) parts.push(String(n.props.label));
      if (n.content) visitInline(n.content);
    }
  };
  const visitBlock = (b: DocBlock): void => {
    visitInline(b.content);
    b.children?.forEach(visitBlock);
  };
  blocks.forEach(visitBlock);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Chunk long text for multi-vector embedding (§6.1 chunkIndex). Simple char-window chunker. */
export function chunkText(text: string, maxChars = 1500): string[] {
  if (text.length <= maxChars) return text ? [text] : [];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) {
    chunks.push(text.slice(i, i + maxChars));
  }
  return chunks;
}
