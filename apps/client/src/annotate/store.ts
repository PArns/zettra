/**
 * Design annotation store (impeccable-style live iteration). Annotations are keyed by page path
 * and persisted in localStorage so a review survives reloads. Everything here is pure/DOM-free
 * except the persistence helpers, so the core is unit-testable.
 */

export interface Annotation {
  id: string;
  /** Best-effort CSS selector of the annotated element (for the agent to locate it). */
  selector: string;
  /** Short label of the element (tag + text snippet). */
  label: string;
  /** Page-absolute pin coordinates (px), so the pin re-renders at the same spot. */
  x: number;
  y: number;
  /** Path the annotation belongs to. */
  path: string;
  note: string;
  resolved: boolean;
  createdAt: number;
}

const KEY = 'zettra.annotations';

type Store = Record<string, Annotation[]>;

function read(): Store {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store;
  } catch {
    return {};
  }
}

function write(store: Store): void {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function listAnnotations(path: string): Annotation[] {
  return (read()[path] ?? []).slice().sort((a, b) => a.createdAt - b.createdAt);
}

export function saveAnnotation(a: Annotation): void {
  const store = read();
  const list = store[a.path] ?? [];
  const idx = list.findIndex((x) => x.id === a.id);
  if (idx >= 0) list[idx] = a;
  else list.push(a);
  store[a.path] = list;
  write(store);
}

export function removeAnnotation(path: string, id: string): void {
  const store = read();
  store[path] = (store[path] ?? []).filter((a) => a.id !== id);
  write(store);
}

export function clearAnnotations(path: string): void {
  const store = read();
  delete store[path];
  write(store);
}

/**
 * A stable-ish CSS selector for an element: prefer #id, else a short tag[.class]:nth-of-type
 * path up to a landmark. Pure given a DOM node; no writes.
 */
export function cssPath(el: Element): string {
  if (el.id) return `#${el.id}`;
  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && node.nodeType === 1 && depth < 4 && node.tagName.toLowerCase() !== 'body') {
    let part = node.tagName.toLowerCase();
    const cls = (node.getAttribute('class') ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((c) => `.${c}`)
      .join('');
    part += cls;
    const parent = node.parentElement;
    if (parent) {
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    if (node.id) {
      parts[0] = `#${node.id}`;
      break;
    }
    node = node.parentElement;
    depth++;
  }
  return parts.join(' > ');
}

/** A short human label for an element: tag + a trimmed text snippet. */
export function elementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 32);
  return text ? `${tag} · "${text}"` : tag;
}

/** Export a page's annotations as agent-ready markdown (paste into the coding agent). */
export function exportMarkdown(path: string): string {
  const list = listAnnotations(path).filter((a) => !a.resolved);
  if (list.length === 0) return `No open annotations for ${path}.`;
  const lines = [`# Design annotations for ${path}`, ''];
  list.forEach((a, i) => {
    lines.push(`${i + 1}. **${a.label}** — \`${a.selector}\``);
    lines.push(`   ${a.note}`);
  });
  return lines.join('\n');
}
