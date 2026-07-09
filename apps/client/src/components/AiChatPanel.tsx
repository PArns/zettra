import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useT } from '../i18n';
import { clickable } from '../lib/a11y';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  sources?: { blockId: string; title: string }[];
}

/**
 * AI chat over the index (§1): ask a question, get an answer grounded in your notes with source
 * chips that open the block. Permission-scoped + privacy-gated server-side.
 */
export function AiChatPanel({
  onClose,
  onOpenBlock,
}: {
  onClose: () => void;
  onOpenBlock: (id: string) => void;
}) {
  const t = useT();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, busy]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setBusy(true);
    try {
      const res = await api.aiChat(q);
      setMessages((m) => [...m, { role: 'assistant', text: res.answer, sources: res.sources }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'assistant', text: (err as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="ai-chat glass-strong">
      <div className="ai-chat-head">
        <span className="modal-title">✦ {t('chat.title')}</span>
        <button className="icon" aria-label={t('common.close')} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="ai-chat-body" ref={scrollRef}>
        {messages.length === 0 && <div className="ai-chat-empty">{t('chat.empty')}</div>}
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            <div className="ai-msg-text">{m.text}</div>
            {m.sources && m.sources.length > 0 && (
              <div className="ai-sources">
                {m.sources.map((s) => (
                  <span
                    key={s.blockId}
                    className="ai-source"
                    {...clickable(() => onOpenBlock(s.blockId))}
                  >
                    {s.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="ai-msg assistant ai-thinking">{t('chat.thinking')}</div>}
      </div>
      <div className="ai-chat-input">
        <input
          value={input}
          placeholder={t('chat.placeholder')}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="primary" onClick={send} disabled={busy || !input.trim()}>
          {t('chat.send')}
        </button>
      </div>
    </aside>
  );
}
