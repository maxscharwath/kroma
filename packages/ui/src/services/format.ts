// The kit's binding of @kroma/core's value formatters to the active locale, so
// a screen never has to carry one around. Lives here rather than in core
// because this is where the locale context is, and it is what every shell and
// every module already reaches for when it wants `useT`.

import {
  decimal,
  formatBytes,
  formatDuration,
  formatElapsed,
  formatHours,
  formatMbps,
  formatTimecodeMs,
  formatUptime,
} from '@kroma/core';
import { useMemo } from 'react';
import { useLocale, useT } from './i18n-context';

export interface Format {
  /** A byte size in the locale's units: `1,5 Go` / `1.5 GB`. */
  bytes: (bytes: number) => string;
  /** A fixed-point number with the locale's separator. One decimal by default. */
  decimal: (n: number, digits?: number) => string;
  /** How long ago an ISO timestamp was, in words. Null reads as "never". */
  elapsed: (iso: string | null | undefined) => string;
  /** Uptime at the coarsest useful scale, from seconds. */
  uptime: (seconds: number) => string;
  /** Watch time to the minute, from milliseconds. */
  duration: (ms: number) => string;
  /** Hours with one decimal for a chart axis, from milliseconds. */
  hours: (ms: number) => string;
  /** A throughput figure, one decimal, no unit. */
  mbps: (n: number) => string;
  /** A scrub-bar timecode, from milliseconds. */
  timecode: (ms: number) => string;
}

/** Every value formatter, bound to the locale on screen. */
export function useFormat(): Format {
  const locale = useLocale();
  const t = useT();
  return useMemo(
    () => ({
      bytes: (bytes) => formatBytes(bytes, locale),
      decimal: (n, digits) => decimal(n, locale, digits),
      elapsed: (iso) => formatElapsed(t, locale, iso),
      uptime: (seconds) => formatUptime(t, seconds),
      duration: (ms) => formatDuration(t, ms),
      hours: (ms) => formatHours(ms, locale),
      mbps: (n) => formatMbps(n, locale),
      timecode: formatTimecodeMs,
    }),
    [locale, t],
  );
}
