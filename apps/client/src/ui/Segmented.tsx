import { cx } from './cx';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  title?: string;
}

/** Compact segmented control (radio-group semantics). Generic over the value union. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  ariaLabel,
}: {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}) {
  const pad = size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm';
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-0.5"
    >
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
              pad,
              on ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
