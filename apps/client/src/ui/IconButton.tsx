import type { ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

/** Square, borderless icon button for topbar/toolbar affordances. `label` is required for a11y. */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(
        'grid h-9 w-9 place-items-center rounded-lg bg-transparent text-text transition-colors',
        'hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
