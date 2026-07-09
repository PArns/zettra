import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

const base =
  'w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-text ' +
  'placeholder:text-faint transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-[var(--ring)] ' +
  'disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(base, className)} {...rest} />;
  },
);

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  children: (id: string) => ReactNode;
}

/** Labelled form field. Generates a stable id and wires it to the control for a11y. */
export function Field({ label, hint, htmlFor, children }: FieldProps) {
  const auto = useId();
  const id = htmlFor ?? auto;
  return (
    <div className="mb-3">
      <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-muted">
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}
