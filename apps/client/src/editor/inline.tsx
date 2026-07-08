import { BlockNoteSchema, defaultInlineContentSpecs } from '@blocknote/core';
import { createReactInlineContentSpec } from '@blocknote/react';

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

/** BlockNote schema extended with the reference + tag inline content specs. */
export const schema = BlockNoteSchema.create({
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    reference: Reference,
    tag: TagInline,
  },
});

export type ZettraSchema = typeof schema;
