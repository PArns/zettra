import { cx } from './cx';

/** Deterministic gradient hue from a string so each user gets a stable, distinct avatar. */
function hue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function Avatar({
  name,
  size = 30,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name.trim().slice(0, 2).toUpperCase() || '?';
  const h = hue(name || 'anon');
  return (
    <span
      className={cx('grid place-items-center rounded-full font-bold text-white', className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, hsl(${h} 70% 58%), hsl(${(h + 40) % 360} 72% 62%))`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
