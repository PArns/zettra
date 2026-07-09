import { createReactBlockSpec } from '@blocknote/react';
import {
  BLOCK_TYPES,
  bookmarkHost,
  bookmarkPropSchema,
  calloutMeta,
  calloutPropSchema,
} from '@zettra/shared';

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
