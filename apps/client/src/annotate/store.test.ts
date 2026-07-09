import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAnnotations,
  cssPath,
  elementLabel,
  exportMarkdown,
  listAnnotations,
  removeAnnotation,
  saveAnnotation,
  type Annotation,
} from './store';

const make = (id: string, over: Partial<Annotation> = {}): Annotation => ({
  id,
  selector: '.x',
  label: 'button',
  x: 1,
  y: 2,
  path: '/p',
  note: `note ${id}`,
  resolved: false,
  createdAt: Number(id),
  ...over,
});

beforeEach(() => localStorage.clear());

describe('annotation store', () => {
  it('saves, lists (sorted by createdAt), updates, and removes', () => {
    saveAnnotation(make('2'));
    saveAnnotation(make('1'));
    expect(listAnnotations('/p').map((a) => a.id)).toEqual(['1', '2']);

    saveAnnotation(make('1', { note: 'edited' }));
    expect(listAnnotations('/p').find((a) => a.id === '1')?.note).toBe('edited');
    expect(listAnnotations('/p')).toHaveLength(2);

    removeAnnotation('/p', '1');
    expect(listAnnotations('/p').map((a) => a.id)).toEqual(['2']);
  });

  it('scopes annotations by path', () => {
    saveAnnotation(make('1', { path: '/a' }));
    saveAnnotation(make('2', { path: '/b' }));
    expect(listAnnotations('/a')).toHaveLength(1);
    expect(listAnnotations('/b')).toHaveLength(1);
    clearAnnotations('/a');
    expect(listAnnotations('/a')).toHaveLength(0);
    expect(listAnnotations('/b')).toHaveLength(1);
  });

  it('exports only open annotations as markdown', () => {
    saveAnnotation(make('1', { note: 'fix spacing' }));
    saveAnnotation(make('2', { resolved: true }));
    const md = exportMarkdown('/p');
    expect(md).toContain('fix spacing');
    expect(md).not.toContain('note 2');
  });
});

describe('cssPath / elementLabel', () => {
  it('prefers an element id', () => {
    document.body.innerHTML = '<div id="hero"><button>Go</button></div>';
    const btn = document.querySelector('button')!;
    expect(cssPath(document.getElementById('hero')!)).toBe('#hero');
    expect(cssPath(btn)).toContain('#hero');
  });

  it('builds a nth-of-type path without ids', () => {
    document.body.innerHTML = '<section><p>a</p><p>b</p></section>';
    const second = document.querySelectorAll('p')[1];
    expect(cssPath(second)).toContain('p:nth-of-type(2)');
  });

  it('labels an element by tag + text snippet', () => {
    document.body.innerHTML = '<button>Create new</button>';
    expect(elementLabel(document.querySelector('button')!)).toBe('button · "Create new"');
  });
});
