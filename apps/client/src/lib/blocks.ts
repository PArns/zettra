import { extractPlainText, type DocBlock } from '@zettra/shared';
import type { BlockDto } from '@zettra/shared';

function toDoc(content: unknown): DocBlock[] {
  return Array.isArray(content) ? (content as DocBlock[]) : [];
}

interface FirstBlock {
  type?: string;
  props?: { name?: string; caption?: string; url?: string };
}

/** Label a media/file block that carries no prose, so it isn't just "Untitled" in lists (§8.3). */
function mediaLabel(block: BlockDto): string | null {
  const first = toDoc(block.content)[0] as FirstBlock | undefined;
  switch (first?.type) {
    case 'image':
      return first.props?.caption || '🖼 Bild';
    case 'pdf':
      return `📄 ${first.props?.name || 'PDF'}`;
    case 'file':
      return first.props?.name || '📎 Datei';
    case 'audio':
      return '🎵 Audio';
    case 'video':
      return '🎬 Video';
    default:
      return null;
  }
}

/** A human title for a block: first line of its text, a media label, or a fallback. */
export function blockTitle(block: BlockDto): string {
  const text = extractPlainText(toDoc(block.content)).trim();
  if (text) return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  return mediaLabel(block) ?? 'Untitled';
}

export function blockPreview(block: BlockDto): string {
  const text = extractPlainText(toDoc(block.content)).slice(0, 200);
  if (text) return text;
  return mediaLabel(block) ?? '';
}
