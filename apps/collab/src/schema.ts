import {
  BlockNoteSchema,
  createInlineContentSpec,
  defaultInlineContentSpecs,
} from '@blocknote/core';

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

export const serverSchema = BlockNoteSchema.create({
  inlineContentSpecs: { ...defaultInlineContentSpecs, reference, tag },
});
