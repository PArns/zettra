import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-contrast border-transparent shadow-sm hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-2 text-text border-border hover:bg-hover',
  ghost: 'bg-transparent text-text border-transparent hover:bg-hover',
  danger: 'bg-red text-white border-transparent hover:brightness-110',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  leading?: ReactNode;
}

/** The one button. Token-driven variants, focus ring, disabled + busy handling. */
export function Button({
  variant = 'secondary',
  size = 'md',
  block,
  leading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cx(
        'inline-flex select-none items-center justify-center whitespace-nowrap border font-medium',
        'transition-[background,border-color,filter,transform] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
        'active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      disabled={disabled}
      {...rest}
    >
      {leading}
      {children}
    </button>
  );
}
