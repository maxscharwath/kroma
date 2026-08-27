// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { readSession, writeSession } from './session';

const KEY = 'kroma:i18n-devtools';

afterEach(() => {
  sessionStorage.clear();
});

describe('the dev-tools session', () => {
  it('starts closed, with nothing overridden', () => {
    expect(readSession()).toEqual({ open: false, keys: false, locale: null, x: null, y: null });
  });

  it('remembers a switch across a reload, which is what a hot reload is', () => {
    writeSession({ open: true, keys: true, locale: 'fr' });

    expect(readSession()).toMatchObject({ open: true, keys: true, locale: 'fr' });
  });

  it('merges a patch over what is stored rather than replacing it', () => {
    writeSession({ open: true, locale: 'fr' });
    writeSession({ x: 40, y: 60 });

    expect(readSession()).toMatchObject({ open: true, locale: 'fr', x: 40, y: 60 });
  });

  it('falls back to closed when the stored blob is not what it claims', () => {
    sessionStorage.setItem(KEY, '{"open":"yes"}');

    expect(readSession().open).toBe(false);
  });

  it('falls back to closed when the stored blob is not JSON at all', () => {
    sessionStorage.setItem(KEY, 'not json');

    expect(readSession().open).toBe(false);
  });

  it('ignores a blob too large to be its own', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ open: true, locale: 'x'.repeat(600) }));

    expect(readSession().open).toBe(false);
  });
});
