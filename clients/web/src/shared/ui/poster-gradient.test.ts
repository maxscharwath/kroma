import { describe, expect, it } from 'vitest';
import { posterGradient } from '#web/shared/ui/poster-gradient';

describe('posterGradient', () => {
  it('is deterministic for a given seed', () => {
    expect(posterGradient('Dune')).toBe(posterGradient('Dune'));
  });

  it('differs for different seeds and is a CSS gradient', () => {
    const a = posterGradient('Dune');

    expect(a.startsWith('radial-gradient(')).toBe(true);
    expect(a).toContain('linear-gradient(');
    expect(a).not.toBe(posterGradient('Arrival'));
  });
});
