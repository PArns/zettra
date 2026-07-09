import type { ReactNode } from 'react';

/** Centered empty/placeholder state with an emoji glyph, title, and optional action. */
export function EmptyState({
  glyph = '✨',
  title,
  hint,
  action,
}: {
  glyph?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
      <div className="mb-3 text-4xl">{glyph}</div>
      <div className="text-[15px] font-semibold text-text">{title}</div>
      {hint && <div className="mt-1.5 max-w-sm text-sm text-faint">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
