import { useEffect, useState } from 'react';
import { createReactBlockSpec } from '@blocknote/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {
  BLOCK_TYPES,
  bookmarkHost,
  bookmarkPropSchema,
  calloutMeta,
  calloutPropSchema,
  mathPropSchema,
  mermaidPropSchema,
  pdfPropSchema,
  togglePropSchema,
} from '@zettra/shared';
import { resolvedTheme } from '../lib/theme';

/**
 * Client (React) BlockNote block specs for the custom blocks (§4). The prop schemas come from
 * `@zettra/editor-ext` so they stay identical to the collab server's DOM specs — otherwise the
 * Yjs round-trip would drop these blocks. Styling lives in styles.css (`.zx-*`).
 */

export const CalloutBlock = createReactBlockSpec(
  { type: BLOCK_TYPES.callout, propSchema: calloutPropSchema, content: 'inline' } as const,
  {
    render: ({ block, editor, contentRef }) => {
      const meta = calloutMeta(block.props.kind);
      const cycle = () => {
        // Click the glyph to cycle through kinds — a lightweight type switcher.
        const order = ['info', 'tip', 'warning', 'danger', 'note'] as const;
        const next = order[(order.indexOf(meta.label.toLowerCase() as never) + 1) % order.length];
        editor.updateBlock(block, { type: BLOCK_TYPES.callout, props: { kind: next } });
      };
      return (
        <div className="zx-callout" style={{ ['--ck' as string]: `var(${meta.colorVar})` }}>
          <button
            type="button"
            className="zx-callout-glyph"
            contentEditable={false}
            onClick={cycle}
            title="Change type"
          >
            {meta.glyph}
          </button>
          <div className="zx-callout-body" ref={contentRef} />
        </div>
      );
    },
  },
);

export const QuoteBlock = createReactBlockSpec(
  { type: BLOCK_TYPES.quote, propSchema: {}, content: 'inline' } as const,
  {
    render: ({ contentRef }) => <blockquote className="zx-quote" ref={contentRef} />,
  },
);

export const DividerBlock = createReactBlockSpec(
  { type: BLOCK_TYPES.divider, propSchema: {}, content: 'none' } as const,
  {
    render: () => (
      <div className="zx-divider" contentEditable={false}>
        <hr />
      </div>
    ),
  },
);

/** LaTeX math, rendered synchronously with KaTeX. Click to edit the source. */
export const MathBlock = createReactBlockSpec(
  { type: BLOCK_TYPES.math, propSchema: mathPropSchema, content: 'none' } as const,
  {
    render: ({ block, editor }) => {
      const latex = block.props.latex;
      const edit = () => {
        const next = window.prompt('LaTeX', latex);
        if (next != null) {
          editor.updateBlock(block, { type: BLOCK_TYPES.math, props: { latex: next } });
        }
      };
      let html = '';
      if (latex) {
        // KaTeX never throws with throwOnError:false — it renders the error inline instead.
        html = katex.renderToString(latex, { throwOnError: false, displayMode: true });
      }
      return (
        <div className="zx-math" contentEditable={false} onClick={edit} title="Edit LaTeX">
          {latex ? (
            <span dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <span className="zx-block-empty">Click to add a formula…</span>
          )}
        </div>
      );
    },
  },
);

/** Mermaid diagram. mermaid is heavy + async, so it is lazily imported and rendered off-render. */
export const MermaidBlock = createReactBlockSpec(
  { type: BLOCK_TYPES.mermaid, propSchema: mermaidPropSchema, content: 'none' } as const,
  {
    render: ({ block, editor }) => {
      const code = block.props.code;
      const [svg, setSvg] = useState('');
      const [error, setError] = useState('');
      useEffect(() => {
        let cancelled = false;
        if (!code.trim()) {
          setSvg('');
          setError('');
          return;
        }
        void (async () => {
          try {
            const mermaid = (await import('mermaid')).default;
            mermaid.initialize({
              startOnLoad: false,
              securityLevel: 'strict',
              theme: resolvedTheme() === 'dark' ? 'dark' : 'default',
            });
            const id = `zx-mmd-${Math.random().toString(36).slice(2)}`;
            const { svg: out } = await mermaid.render(id, code);
            if (!cancelled) {
              setSvg(out);
              setError('');
            }
          } catch (e) {
            if (!cancelled) {
              setSvg('');
              setError(e instanceof Error ? e.message : String(e));
            }
          }
        })();
        return () => {
          cancelled = true;
        };
      }, [code]);
      const edit = () => {
        const next = window.prompt('Mermaid diagram source', code);
        if (next != null) {
          editor.updateBlock(block, { type: BLOCK_TYPES.mermaid, props: { code: next } });
        }
      };
      return (
        <div className="zx-mermaid" contentEditable={false} onClick={edit} title="Edit diagram">
          {!code.trim() ? (
            <span className="zx-block-empty">Click to add a Mermaid diagram…</span>
          ) : error ? (
            <pre className="zx-mermaid-error">{error}</pre>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: svg }} />
          )}
        </div>
      );
    },
  },
);

/**
 * Collapsible toggle: an inline header plus nested child blocks. Clicking the caret flips the
 * `open` prop; BlockNote mirrors block props to `data-*` on `.bn-block-content`, so a CSS rule
 * (styles.css) hides the sibling `.bn-block-group` (the children) when `data-open="false"`.
 */
export const ToggleBlock = createReactBlockSpec(
  { type: BLOCK_TYPES.toggle, propSchema: togglePropSchema, content: 'inline' } as const,
  {
    render: ({ block, editor, contentRef }) => {
      const open = block.props.open;
      const toggle = () =>
        editor.updateBlock(block, { type: BLOCK_TYPES.toggle, props: { open: !open } });
      return (
        <div className="zx-toggle" data-open={open}>
          <button
            type="button"
            className="zx-toggle-caret"
            contentEditable={false}
            onClick={toggle}
            aria-expanded={open}
            title={open ? 'Collapse' : 'Expand'}
          >
            ▶
          </button>
          <div className="zx-toggle-summary" ref={contentRef} />
        </div>
      );
    },
  },
);

export const PdfBlock = createReactBlockSpec(
  { type: BLOCK_TYPES.pdf, propSchema: pdfPropSchema, content: 'none' } as const,
  {
    render: ({ block }) => {
      const { url, name } = block.props;
      return (
        <div className="zx-pdf" contentEditable={false}>
          <div className="zx-pdf-head">
            <span className="zx-pdf-ico" aria-hidden>
              📄
            </span>
            <span className="zx-pdf-name">{name || 'PDF'}</span>
            <a className="zx-pdf-open" href={url} target="_blank" rel="noreferrer">
              Öffnen ↗
            </a>
          </div>
          {url ? (
            <iframe className="zx-pdf-frame" src={`${url}#toolbar=0`} title={name || 'PDF'} />
          ) : null}
        </div>
      );
    },
  },
);

export const BookmarkBlock = createReactBlockSpec(
  { type: BLOCK_TYPES.bookmark, propSchema: bookmarkPropSchema, content: 'none' } as const,
  {
    render: ({ block }) => {
      const { url, title, description, favicon } = block.props;
      const host = bookmarkHost(url);
      return (
        <a
          className="zx-bookmark"
          href={url}
          target="_blank"
          rel="noreferrer"
          contentEditable={false}
        >
          <div className="zx-bookmark-main">
            <div className="zx-bookmark-title">{title || host}</div>
            {description && <div className="zx-bookmark-desc">{description}</div>}
            <div className="zx-bookmark-host">
              {favicon ? <img src={favicon} alt="" /> : <span aria-hidden>🔗</span>}
              {host}
            </div>
          </div>
        </a>
      );
    },
  },
);
