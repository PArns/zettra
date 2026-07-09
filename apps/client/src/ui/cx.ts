/** Tiny className joiner — drops falsy values, joins with spaces. No dependency needed. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
