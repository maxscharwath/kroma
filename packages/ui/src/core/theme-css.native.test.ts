import { describe, expect, it, vi } from 'vitest';

// The native vitest project mirrors Metro's module RESOLUTION, not the runtime:
// it still aliases `react-native` to react-native-web, so `Platform.OS` answers
// `web` there. Overriding it is the only way to reach the branch a television
// and a phone actually take.
vi.mock('react-native', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
}));

describe('the palette on a native target', () => {
  it('stays literal, because React Native has no cascade to resolve a property in', async () => {
    const { KROMA } = await import('./theme');
    expect(KROMA.colors.accent).toBe('#F4B642');
    expect(KROMA.colors.textMuted).toBe('rgba(244, 243, 240, 0.62)');
    expect(KROMA.shadow.card).toContain('rgba(');
    expect(KROMA.ring.focus.outlineColor).toBe('#F4B642');
  });

  it('mixes an alpha step down to rgba', async () => {
    const { color } = await import('./color');
    expect(color('text/85')).toBe('rgba(244, 243, 240, 0.85)');
  });

  it('still splits a translucent token, since there is no property to defer to', async () => {
    const { splitAlpha } = await import('./tokens/colors');
    const { KROMA } = await import('./theme');
    expect(splitAlpha(KROMA.colors.textDim)).toEqual({
      color: 'rgb(244, 243, 240)',
      opacity: 0.48,
    });
  });
});
