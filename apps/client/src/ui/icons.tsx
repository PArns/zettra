/**
 * Tiny inline SVG icons. Unicode glyphs like ✓/✕ render with inconsistent ink metrics across
 * fonts (one sits high, one large), so buttons that pair them look misaligned even when their
 * boxes are identical. These share one viewBox and stroke, so they're pixel-consistent.
 */
interface IconProps {
  size?: number;
}

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
