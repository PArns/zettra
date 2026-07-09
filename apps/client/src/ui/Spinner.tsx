import { cx } from './cx';

/** Indeterminate spinner sized in px. Uses the accent for the leading arc. */
export function Spinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        'inline-block animate-spin rounded-full border-2 border-border-strong',
        className,
      )}
      style={{ width: size, height: size, borderTopColor: 'var(--accent)' }}
    />
  );
}
