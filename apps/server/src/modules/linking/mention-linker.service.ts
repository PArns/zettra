import { Injectable } from '@nestjs/common';
import { DocBlock, InlineNode, REFERENCE_NODE_TYPE } from '@zettra/shared';
import { AliasEntry } from './alias-index.service';

/**
 * Deterministic mention linking (§8.4 layer 1). Rather than writing edges directly — which
 * would collide with the mention-scoped materialize deletes (invariant 5) — the linker
 * ANNOTATES captured content by inserting `reference` inline nodes where a known alias
 * appears in plain text. The edges then flow through `extractRefs`/materialize, keeping the
 * Yjs/doc the single source of truth (invariant 7).
 *
 * This runs on system-captured content (ingest), not while a user types, so it does not
 * violate the "suggest, never force-replace" rule for live editing (invariant 10).
 */
@Injectable()
export class MentionLinkerService {
  /** Longest-alias-first so "Jane Doe" wins over "Jane". Case-insensitive, word-boundaried. */
  annotate(blocks: DocBlock[], aliases: AliasEntry[]): DocBlock[] {
    if (aliases.length === 0) return blocks;
    const sorted = [...aliases].sort((a, b) => b.alias.length - a.alias.length);
    return blocks.map((b) => this.annotateBlock(b, sorted));
  }

  private annotateBlock(block: DocBlock, aliases: AliasEntry[]): DocBlock {
    return {
      ...block,
      content: block.content ? this.annotateInline(block.content, aliases) : block.content,
      children: block.children?.map((c) => this.annotateBlock(c, aliases)),
    };
  }

  private annotateInline(nodes: InlineNode[], aliases: AliasEntry[]): InlineNode[] {
    const out: InlineNode[] = [];
    for (const node of nodes) {
      if (node.type === 'text' && typeof node.text === 'string') {
        out.push(...this.splitText(node.text, aliases));
      } else {
        out.push(node);
      }
    }
    return out;
  }

  /** Split a text run into text + reference nodes at the first matching alias occurrence. */
  private splitText(text: string, aliases: AliasEntry[]): InlineNode[] {
    for (const { alias, blockId } of aliases) {
      const re = new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i');
      const m = re.exec(text);
      if (!m) continue;
      const start = m.index;
      const end = start + m[0].length;
      const before = text.slice(0, start);
      const after = text.slice(end);
      const result: InlineNode[] = [];
      if (before) result.push({ type: 'text', text: before });
      result.push({ type: REFERENCE_NODE_TYPE, props: { blockId, label: m[0] } });
      // Recurse into the remainder so multiple mentions in one run are all linked.
      if (after) result.push(...this.splitText(after, aliases));
      return result;
    }
    return [{ type: 'text', text }];
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
