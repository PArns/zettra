import {
  BlockNoteSchema,
  createBlockSpec,
  createInlineContentSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from '@blocknote/core';
import {
  BLOCK_TYPES,
  bookmarkHost,
  bookmarkPropSchema,
  calloutMeta,
  calloutPropSchema,
  mathPropSchema,
  mermaidPropSchema,
  pdfPropSchema,
  spreadsheetPropSchema,
  togglePropSchema,
} from '@zettra/shared';

/**
 * Server-side BlockNote schema mirroring the client's custom inline content (§8.6): the
 * `reference` and `tag` primitives with `propSchema { blockId, label }` (invariant 4). The
 * DOM render is only exercised by ServerBlockNoteEditor's document shim; the parser needs the
 * specs registered so `yDocToBlocks` preserves these nodes (and thus their `blockId`s).
 */
const reference = createInlineContentSpec(
  {
    type: 'reference',
    propSchema: { blockId: { default: '' }, label: { default: '' } },
    content: 'none',
  } as const,
  {
    render: (ic) => {
      const dom = document.createElement('span');
      dom.className = 'zx-ref';
      dom.textContent = String(ic.props.label ?? '');
      return { dom };
    },
  },
);

const tag = createInlineContentSpec(
  {
    type: 'tag',
    propSchema: { blockId: { default: '' }, label: { default: '' } },
    content: 'none',
  } as const,
  {
    render: (ic) => {
      const dom = document.createElement('span');
      dom.className = 'zx-tag';
      dom.textContent = `#${String(ic.props.label ?? '')}`;
      return { dom };
    },
  },
);

/**
 * Server DOM specs for the custom blocks, mirroring the client's React specs (§4). Same
 * `type` + propSchema (imported from `@zettra/editor-ext`) so `yDocToBlocks` preserves them and
 * their inline content (references/tags inside a callout still materialize). The DOM render is
 * only exercised by ServerBlockNoteEditor's HTML round-trip.
 */
const callout = createBlockSpec(
  { type: BLOCK_TYPES.callout, propSchema: calloutPropSchema, content: 'inline' } as const,
  {
    render: (block) => {
      const meta = calloutMeta(block.props.kind);
      const dom = document.createElement('div');
      dom.className = 'zx-callout';
      const glyph = document.createElement('span');
      glyph.className = 'zx-callout-glyph';
      glyph.textContent = meta.glyph;
      const body = document.createElement('div');
      body.className = 'zx-callout-body';
      dom.append(glyph, body);
      return { dom, contentDOM: body };
    },
  },
);

const quote = createBlockSpec(
  { type: BLOCK_TYPES.quote, propSchema: {}, content: 'inline' } as const,
  {
    render: () => {
      const dom = document.createElement('blockquote');
      dom.className = 'zx-quote';
      return { dom, contentDOM: dom };
    },
  },
);

const divider = createBlockSpec(
  { type: BLOCK_TYPES.divider, propSchema: {}, content: 'none' } as const,
  {
    render: () => {
      const dom = document.createElement('div');
      dom.className = 'zx-divider';
      dom.appendChild(document.createElement('hr'));
      return { dom };
    },
  },
);

const bookmark = createBlockSpec(
  { type: BLOCK_TYPES.bookmark, propSchema: bookmarkPropSchema, content: 'none' } as const,
  {
    render: (block) => {
      const url = String(block.props.url ?? '');
      const dom = document.createElement('a');
      dom.className = 'zx-bookmark';
      dom.setAttribute('href', url);
      // Text content so the HTML→text projection (search/embedding) sees the title + host.
      dom.textContent = `${String(block.props.title ?? '') || bookmarkHost(url)} ${bookmarkHost(url)}`;
      return { dom };
    },
  },
);

// Math + Mermaid keep their source as the block's text so the HTML→text projection
// (search/embedding) indexes the formula/diagram source; the visual render is client-only.
const math = createBlockSpec(
  { type: BLOCK_TYPES.math, propSchema: mathPropSchema, content: 'none' } as const,
  {
    render: (block) => {
      const dom = document.createElement('div');
      dom.className = 'zx-math';
      dom.textContent = String(block.props.latex ?? '');
      return { dom };
    },
  },
);

const mermaid = createBlockSpec(
  { type: BLOCK_TYPES.mermaid, propSchema: mermaidPropSchema, content: 'none' } as const,
  {
    render: (block) => {
      const dom = document.createElement('div');
      dom.className = 'zx-mermaid';
      dom.textContent = String(block.props.code ?? '');
      return { dom };
    },
  },
);

// Toggle: an inline header over nested children. The server only needs the header's inline
// content preserved (its child blocks are separate rows); collapse is a client-only concern.
const toggle = createBlockSpec(
  { type: BLOCK_TYPES.toggle, propSchema: togglePropSchema, content: 'inline' } as const,
  {
    render: () => {
      const dom = document.createElement('div');
      dom.className = 'zx-toggle';
      const body = document.createElement('div');
      body.className = 'zx-toggle-summary';
      dom.appendChild(body);
      return { dom, contentDOM: body };
    },
  },
);

// Embedded PDF: the server keeps the file name as text so the projection indexes it; the PDF's
// own text layer is extracted separately by the embed worker (unpdf).
const pdf = createBlockSpec(
  { type: BLOCK_TYPES.pdf, propSchema: pdfPropSchema, content: 'none' } as const,
  {
    render: (block) => {
      const dom = document.createElement('div');
      dom.className = 'zx-pdf';
      dom.textContent = String(block.props.name ?? '');
      return { dom };
    },
  },
);

// Spreadsheet: the whole grid lives as JSON in `data`; the server keeps it opaque (round-trip only).
const spreadsheet = createBlockSpec(
  { type: BLOCK_TYPES.spreadsheet, propSchema: spreadsheetPropSchema, content: 'none' } as const,
  {
    render: () => {
      const dom = document.createElement('div');
      dom.className = 'zx-sheet';
      return { dom };
    },
  },
);

export const serverSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    callout,
    quote,
    divider,
    bookmark,
    math,
    mermaid,
    toggle,
    pdf,
    spreadsheet,
  },
  inlineContentSpecs: { ...defaultInlineContentSpecs, reference, tag },
});
