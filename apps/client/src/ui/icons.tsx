/**
 * Tiny inline SVG icons. Unicode glyphs like ✓/✕ render with inconsistent ink metrics across
 * fonts (one sits high, one large), so buttons that pair them look misaligned even when their
 * boxes are identical. These share one viewBox and stroke, so they're pixel-consistent.
 */
import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
}

/**
 * Consistent stroked line-icons for app chrome (sidebar nav, section actions). One geometry
 * language — 24-unit grid, round caps/joins, currentColor — so the navigation reads as a set
 * rather than a bag of mismatched emoji. Content icons (supertags) stay expressive emoji.
 */
function Line({ size = 18, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const IconToday = (p: IconProps) => (
  <Line {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Line>
);
export const IconCalendar = (p: IconProps) => (
  <Line {...p}>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 2.5v4M16 2.5v4" />
  </Line>
);
export const IconInbox = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 13l2.5-7.5A2 2 0 0 1 7.4 4h9.2a2 2 0 0 1 1.9 1.5L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M3 13h5l1.5 2.5h5L16 13h5" />
  </Line>
);
export const IconReview = (p: IconProps) => (
  <Line {...p}>
    <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10l2 2.5h6.5A1.5 1.5 0 0 1 20 8v10.5A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5z" />
    <path d="M9.5 13.5l1.8 1.8 3.2-3.6" />
  </Line>
);
export const IconSparkles = (p: IconProps) => (
  <Line {...p}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z" />
    <path d="M18 14l.8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8z" />
  </Line>
);
export const IconSearch = (p: IconProps) => (
  <Line {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.2-4.2" />
  </Line>
);
export const IconPlus = (p: IconProps) => (
  <Line {...p}>
    <path d="M12 5v14M5 12h14" />
  </Line>
);
export const IconFolder = (p: IconProps) => (
  <Line {...p}>
    <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h7A1.5 1.5 0 0 1 19 9v8.5A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5z" />
  </Line>
);
export const IconSpace = (p: IconProps) => (
  <Line {...p}>
    <path d="M4 9h16M4 15h16M10 4L8 20M16 4l-2 16" />
  </Line>
);

export function IconCheck({ size = 15 }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

export function IconX({ size = 15 }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
