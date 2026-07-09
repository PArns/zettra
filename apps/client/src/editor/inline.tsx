import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';
import {
  BookmarkBlock,
  CalloutBlock,
  DividerBlock,
  MathBlock,
  MermaidBlock,
  QuoteBlock,
  ToggleBlock,
} from './blocks';

/**
 * The reference inline primitive (§8.6, invariant 4): `#tags` and `[[references]]` are the
 * same node with `propSchema { blockId, label }`, label display-only. `reference` renders as
 * a violet pill, `tag` as a green chip. Both store `blockId`; the label is re-resolved on
 * render (here we display the cached label; live re-resolution is a refinement).
 */
export const Reference = createReactInlineContentSpec(
  {
    type: 'reference',
    propSchema: { blockId: { default: '' }, label: { default: '' } },
    content: 'none',
  } as const,
  {
    render: (props) => (
      <span className="zx-ref" data-block-id={props.inlineContent.props.blockId}>
        {props.inlineContent.props.label}
      </span>
    ),
  },
);

export const TagInline = createReactInlineContentSpec(
  {
    type: 'tag',
    propSchema: { blockId: { default: '' }, label: { default: '' } },
    content: 'none',
  } as const,
  {
    render: (props) => (
      <span className="zx-tag" data-block-id={props.inlineContent.props.blockId}>
        #{props.inlineContent.props.label}
      </span>
    ),
  },
);

/**
 * BlockNote schema extended with the reference + tag inline primitives and the custom blocks
 * (callout, quote, divider, bookmark, math, mermaid, toggle). Must mirror the collab server's
 * `serverSchema` so the Yjs round-trip preserves every node.
 */
export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    callout: CalloutBlock,
    quote: QuoteBlock,
    divider: DividerBlock,
    bookmark: BookmarkBlock,
    math: MathBlock,
    mermaid: MermaidBlock,
    toggle: ToggleBlock,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    reference: Reference,
    tag: TagInline,
  },
});

export type ZettraSchema = typeof schema;
