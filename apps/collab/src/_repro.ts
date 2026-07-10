import * as Y from 'yjs';
import { blocksToYDoc } from './doc-projection';

/** Throwaway: dump the Yjs XML structure the server produces for custom inline-content blocks. */
const blocks = [
  {
    id: 'c1',
    type: 'callout',
    props: { kind: 'info' },
    content: [{ type: 'text', text: 'HELLO CALLOUT', styles: {} }],
    children: [],
  },
  {
    id: 'p1',
    type: 'paragraph',
    props: { textColor: 'default', textAlignment: 'left', backgroundColor: 'default' },
    content: [{ type: 'text', text: 'HELLO PARAGRAPH', styles: {} }],
    children: [],
  },
] as never;

const ydoc = blocksToYDoc(blocks);
if (!ydoc) {
  console.log('null');
  process.exit(1);
}
const frag = ydoc.getXmlFragment('document');

function dump(node: Y.XmlElement | Y.XmlText | Y.XmlHook, depth = 0): void {
  const pad = '  '.repeat(depth);
  if (node instanceof Y.XmlText) {
    console.log(`${pad}#text ${JSON.stringify(node.toString())}`);
    return;
  }
  if (node instanceof Y.XmlElement) {
    const attrs = node.getAttributes();
    console.log(`${pad}<${node.nodeName} ${JSON.stringify(attrs)}>`);
    node.toArray().forEach((c) => dump(c as Y.XmlElement, depth + 1));
  }
}
frag.toArray().forEach((n) => dump(n as Y.XmlElement));
