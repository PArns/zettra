/**
 * Keyboard-grammar trigger detection (§8.6).
 *
 * BlockNote's `SuggestionMenuController` `triggerCharacter` is single-char, so the `[[`
 * reference trigger must be detected manually (implemented as a custom ProseMirror suggestion
 * plugin in the client). These pure detectors are the reusable, unit-tested core of that
 * plugin and of the `#`/`@` menus.
 */

export type TriggerKind = 'tag' | 'reference' | 'person' | 'slash';

export interface TriggerMatch {
  kind: TriggerKind;
  /** The query text after the trigger, up to the cursor. */
  query: string;
  /** Index in `textBefore` where the trigger starts (for replacement ranges). */
  from: number;
}

const SINGLE_CHAR: Record<string, TriggerKind> = {
  '#': 'tag',
  '@': 'person',
  '/': 'slash',
};

/**
 * Detect an active trigger given the text between the block start (or last whitespace) and the
 * cursor. Returns null when no trigger is active. The `[[` trigger takes precedence over `#`
 * so `[[#foo` reads as a reference query, not a tag.
 *
 * A trigger is only active when it starts a token (preceded by start-of-text or whitespace)
 * and the query contains no whitespace (typing a space dismisses the menu).
 */
export function detectTrigger(textBefore: string): TriggerMatch | null {
  const doubleBracket = detectDoubleBracket(textBefore);
  if (doubleBracket) return doubleBracket;

  // Scan back to the token start.
  const tokenStart = tokenStartIndex(textBefore);
  const token = textBefore.slice(tokenStart);
  const first = token[0];
  if (first && first in SINGLE_CHAR) {
    const query = token.slice(1);
    if (!/\s/.test(query)) {
      return { kind: SINGLE_CHAR[first]!, query, from: tokenStart };
    }
  }
  return null;
}

function detectDoubleBracket(textBefore: string): TriggerMatch | null {
  const idx = textBefore.lastIndexOf('[[');
  if (idx === -1) return null;
  const query = textBefore.slice(idx + 2);
  // Closed (`]]`) or whitespace-broken queries are not active.
  if (query.includes(']]') || /\n/.test(query)) return null;
  return { kind: 'reference', query, from: idx };
}

/** Index where the current whitespace-delimited token begins. */
function tokenStartIndex(text: string): number {
  const match = /(\S+)$/.exec(text);
  return match ? text.length - match[1].length : text.length;
}
