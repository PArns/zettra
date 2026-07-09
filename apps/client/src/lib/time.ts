/** Human-friendly relative time ("2h ago"); pair with an absolute `title` tooltip. */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secondsAgo = Math.round((Date.now() - then) / 1000);
  const abs = Math.abs(secondsAgo);
  const steps: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2629800, 'week'],
    [31557600, 'month'],
    [Infinity, 'year'],
  ];
  const divisors: Record<string, number> = {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 86400,
    week: 604800,
    month: 2629800,
    year: 31557600,
  };
  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  for (const [limit, unit] of steps) {
    if (abs < limit) {
      const value = Math.round(-secondsAgo / divisors[unit]);
      return fmt.format(value, unit);
    }
  }
  return new Date(iso).toLocaleDateString();
}

/** Absolute, localized timestamp for tooltips. */
export function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
