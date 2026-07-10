import type { DragEvent } from 'react';

/** dataTransfer MIME a dragged note carries, so a folder can tell a note-drop from a folder-drop. */
export const NOTE_DND_TYPE = 'application/x-zettra-note';

/** Props that make a note row draggable into the folder tree (§8.2). */
export function noteDragProps(blockId: string): {
  draggable: true;
  onDragStart: (e: DragEvent) => void;
} {
  return {
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData(NOTE_DND_TYPE, blockId);
      e.dataTransfer.effectAllowed = 'move';
    },
  };
}
