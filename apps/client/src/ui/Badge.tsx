import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type Tone = 'neutral' | 'accent' | 'green' | 'amber' | 'red' | 'blue';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border-border',
  accent: 'border-transparent text-accent [background:var(--accent-soft)]',
  green:
    'border-transparent text-green [background:color-mix(in_srgb,var(--green)_14%,transparent)]',
  amber:
    'border-transparent text-amber [background:color-mix(in_srgb,var(--amber)_16%,transparent)]',
  red: 'border-transparent text-red [background:color-mix(in_srgb,var(--red)_14%,transparent)]',
  blue: 'border-transparent text-blue [background:color-mix(in_srgb,var(--blue)_14%,transparent)]',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}

/** Pill label. Optional leading status dot. */
export function Badge({ tone = 'neutral', dot, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
