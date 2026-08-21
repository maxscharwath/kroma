import { describe, expect, it } from 'vitest';
import { formatDay } from './day.ts';

describe('formatDay', () => {
  it('reads a release day in the language of the page', () => {
    expect(formatDay('2026-08-14', 'en')).toBe('August 14, 2026');
    expect(formatDay('2026-08-14', 'fr')).toBe('14 août 2026');
  });

  it('keeps the day GitHub stamped rather than shifting it into the local zone', () => {
    const tz = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';

    const rendered = formatDay('2026-01-01', 'en');

    process.env.TZ = tz;
    expect(rendered).toBe('January 1, 2026');
  });
});
