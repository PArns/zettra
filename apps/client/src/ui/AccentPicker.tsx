import { ACCENTS } from '../lib/accent';
import { cx } from './cx';

/** Swatch row for choosing the accent palette. Controlled: `value` is the accent id. */
export function AccentPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-2">
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={a.id === value}
          title={a.label}
          onClick={() => onChange(a.id)}
          className={cx(
            'h-7 w-7 rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
            a.id === value
              ? 'scale-110 ring-2 ring-[var(--text)] ring-offset-2 ring-offset-[var(--surface)]'
              : 'hover:scale-105',
          )}
          style={{ background: `linear-gradient(135deg, ${a.swatch[0]}, ${a.swatch[1]})` }}
        />
      ))}
    </div>
  );
}
