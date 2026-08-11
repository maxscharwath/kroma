import { describe, expect, it } from 'vitest';
import { kromaUI } from './index.ts';

describe('kromaUI', () => {
  it('is the icon subset and the token expansion, in that order', () => {
    expect(kromaUI().map((p) => p.name)).toEqual(['kroma-ui', 'kroma-tokens']);
  });

  it('discovers the workspace root, so a shell config passes nothing', () => {
    expect(() => kromaUI()).not.toThrow();
  });

  it('builds against the root it is handed instead of discovering one', () => {
    expect(() => kromaUI({ repoRoot: '/no/such/workspace' })).toThrow(
      /not found under \/no\/such\/workspace/,
    );
  });

  it('skips the icon scan entirely when every glyph is wanted', () => {
    expect(() => kromaUI({ icons: 'full', repoRoot: '/no/such/workspace' })).not.toThrow();
  });
});
