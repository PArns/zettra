import type { KeyboardEvent } from 'react';

/**
 * Props that make a non-`<button>` element keyboard-operable (Enter/Space) and exposed to
 * assistive tech as a button. Use on clickable cards/rows/menu items where a real button
 * would break layout.
 */
export function clickable(onActivate: () => void): {
  role: 'button';
  tabIndex: 0;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
} {
  return {
    role: 'button',
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
