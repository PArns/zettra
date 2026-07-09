import type { HTMLAttributes } from 'react';
import { cx } from './cx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  active?: boolean;
  padded?: boolean;
}

/** Surface container with the house border/shadow. `interactive` adds hover affordance. */
export function Card({
  interactive,
  active,
  padded = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(
        'rounded-xl border bg-surface shadow-sm transition-[border-color,box-shadow,transform] duration-150',
        padded && 'p-4',
        interactive &&
          'cursor-pointer hover:-translate-y-px hover:border-border-strong hover:shadow',
        active && 'border-accent ring-1 ring-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
