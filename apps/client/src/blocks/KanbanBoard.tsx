import { useState } from 'react';
import { Badge, Card, cx } from '../ui';

export interface KanbanCard {
  id: string;
  title: string;
  tag?: string;
  tone?: 'accent' | 'green' | 'amber' | 'red' | 'blue';
}
export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
}

/**
 * Kanban board with native HTML drag-and-drop between columns. State is local; a wired-up
 * version would persist card→column moves as a field update on each entity row.
 */
export function KanbanBoard({ initial }: { initial: KanbanColumn[] }) {
  const [columns, setColumns] = useState<KanbanColumn[]>(initial);
  const [dragging, setDragging] = useState<{ cardId: string; fromCol: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);

  function move(toCol: string) {
    if (!dragging) return;
    setColumns((cols) => {
      const card = cols
        .find((c) => c.id === dragging.fromCol)
        ?.cards.find((k) => k.id === dragging.cardId);
      if (!card) return cols;
      return cols.map((c) => {
        if (c.id === dragging.fromCol)
          return { ...c, cards: c.cards.filter((k) => k.id !== card.id) };
        if (c.id === toCol && dragging.fromCol !== toCol)
          return { ...c, cards: [...c.cards, card] };
        return c;
      });
    });
    setDragging(null);
    setOver(null);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div
          key={col.id}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(col.id);
          }}
          onDrop={() => move(col.id)}
          className={cx(
            'w-64 shrink-0 rounded-xl border bg-surface-2 p-2 transition-colors',
            over === col.id ? 'border-accent' : 'border-border',
          )}
        >
          <div className="flex items-center justify-between px-1.5 py-1.5 text-[13px] font-semibold text-muted">
            <span>{col.title}</span>
            <span className="text-faint">{col.cards.length}</span>
          </div>
          <div className="flex flex-col gap-2">
            {col.cards.map((card) => (
              <Card
                key={card.id}
                padded={false}
                draggable
                onDragStart={() => setDragging({ cardId: card.id, fromCol: col.id })}
                className="cursor-grab p-2.5 active:cursor-grabbing"
              >
                <div className="text-[13px] font-medium text-text">{card.title}</div>
                {card.tag && (
                  <Badge tone={card.tone ?? 'accent'} className="mt-2">
                    {card.tag}
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
