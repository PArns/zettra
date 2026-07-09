import type { ReactNode } from 'react';
import { cx } from '../ui';

type Kind = 'info' | 'tip' | 'warning' | 'danger' | 'note';

const KIND: Record<Kind, { glyph: string; accent: string; label: string }> = {
  info: { glyph: 'ℹ️', accent: 'var(--blue)', label: 'Info' },
  tip: { glyph: '💡', accent: 'var(--green)', label: 'Tip' },
  warning: { glyph: '⚠️', accent: 'var(--amber)', label: 'Warning' },
  danger: { glyph: '🛑', accent: 'var(--red)', label: 'Danger' },
  note: { glyph: '📝', accent: 'var(--accent)', label: 'Note' },
};

/** Colored callout/admonition box. */
export function Callout({
  kind = 'info',
  title,
  children,
  className,
}: {
  kind?: Kind;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const meta = KIND[kind];
  return (
    <div
      className={cx('flex gap-3 rounded-xl border p-3.5', className)}
      style={{
        borderColor: `color-mix(in srgb, ${meta.accent} 35%, transparent)`,
        background: `color-mix(in srgb, ${meta.accent} 9%, transparent)`,
      }}
    >
      <div className="text-lg leading-6" aria-hidden>
        {meta.glyph}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-text">{title ?? meta.label}</div>
        <div className="mt-0.5 text-sm text-muted">{children}</div>
      </div>
    </div>
  );
}
