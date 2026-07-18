/** Player-chrome formatting helpers shared by web + TV. */

/**
 * Wall-clock time the current playback will finish, given the remaining
 * milliseconds (§1, "fin à 22h38"). Localized: 24h `22h38` for fr, `10:38 PM`
 * for en. Empty string when the runtime is unknown.
 */
export function endsAtClock(remainingMs: number | null | undefined, locale?: string): string {
  if (!remainingMs || remainingMs <= 0) return '';
  const d = new Date(Date.now() + remainingMs);
  if (locale === 'en') {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return `${d.getHours()}h${d.getMinutes().toString().padStart(2, '0')}`;
}

/** Clamp a fraction to [0, 1]. */
export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Percentage (0–100) of `value` within `total`, clamped and safe when total=0. */
export function pct(value: number, total: number): number {
  return total > 0 ? clamp01(value / total) * 100 : 0;
}
