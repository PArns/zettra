import { DocBlock } from './editor';

/**
 * Starter content seeded into a newly created space (§8.2). A friendly welcome note plus a
 * getting-started checklist, returned as settled BlockNote document JSON (invariant 7) so it
 * flows through the normal block-create path. Pure + deterministic so it is unit-testable.
 */
export function welcomeDoc(spaceName: string): DocBlock[] {
  const name = spaceName.trim() || 'your space';
  const check = (text: string): DocBlock => ({
    type: 'checkListItem',
    props: { checked: false },
    content: [{ type: 'text', text }],
  });
  return [
    {
      type: 'heading',
      props: { level: 1 },
      content: [{ type: 'text', text: `Welcome to ${name} 👋` }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Capture anything, then tag it into a typed entity to give it structure. Soft connections surface automatically; hard links stay explicit.',
        },
      ],
    },
    { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'First steps' }] },
    check('Capture your first note with the ✎ button'),
    check('Type # to turn a note into a supertag entity with fields'),
    check('Drop a file, image, or link into the dropbox to auto-tag it'),
    check('Open a saved view to see your entities as a table, board, or gallery'),
  ];
}
