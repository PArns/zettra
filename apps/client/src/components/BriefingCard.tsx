import { useEffect, useState } from 'react';
import { api, type TodoItem } from '../lib/api';
import { clickable } from '../lib/a11y';

interface Briefing {
  briefing: string;
  dueTodos: TodoItem[];
  reminderCount: number;
  updatedCount: number;
}

/**
 * Proactive morning briefing (§4): an AI-written "here's your day" over today's due to-dos,
 * reminders, and freshly touched notes — turning the passive Today feed into an assistant. The
 * LLM call can take a few seconds (and warms lazily), so it renders a shimmer until it lands.
 */
export function BriefingCard({ onOpen }: { onOpen: (id: string) => void }) {
  const [data, setData] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .dailyBriefing()
      .then((b) => setData(b))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Nothing on the plate and no text → don't clutter the Today page with an empty card.
  if (!loading && (!data || (!data.briefing && data.dueTodos.length === 0))) return null;

  return (
    <div className="briefing">
      <div className="briefing-head">
        <span className="briefing-spark" aria-hidden>
          ✦
        </span>
        <span className="briefing-title">Dein Tag</span>
        <button
          className="briefing-refresh"
          aria-label="Briefing neu erstellen"
          title="Neu erstellen"
          onClick={load}
          disabled={loading}
        >
          ↻
        </button>
      </div>

      {loading ? (
        <div className="briefing-skeleton">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <>
          <p className="briefing-text">{data!.briefing}</p>
          {(data!.dueTodos.length > 0 || data!.reminderCount > 0) && (
            <div className="briefing-todos">
              {data!.dueTodos.slice(0, 5).map((t) => (
                <span key={t.blockId} className="briefing-chip" {...clickable(() => onOpen(t.blockId))}>
                  <span className="briefing-dot" />
                  {t.title}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
