import { describe, expect, it } from 'vitest';
import { translateIn } from './translate';

const catalogs = {
  en: {
    simple: 'Simple',
    withVar: 'Hello {name}',
    plural: '{count} items',
    plural_one: '{count} item',
  },
  fr: {
    simple: 'Simple FR',
    plural: '{count} objets',
  },
};

describe('translateIn', () => {
  it('translates simple keys', () => {
    expect(translateIn(catalogs, 'en', 'en', 'simple')).toBe('Simple');
    expect(translateIn(catalogs, 'fr', 'en', 'simple')).toBe('Simple FR');
  });

  it('falls back to the default locale', () => {
    expect(translateIn(catalogs, 'fr', 'en', 'withVar', { name: 'Joe' })).toBe('Hello Joe');
  });

  it('handles plurals', () => {
    expect(translateIn(catalogs, 'en', 'en', 'plural', { count: 1 })).toBe('1 item');
    expect(translateIn(catalogs, 'en', 'en', 'plural', { count: 2 })).toBe('2 items');
    expect(translateIn(catalogs, 'en', 'en', 'plural', { count: 0 })).toBe('0 items');
  });

  it('does not hand a locale another language singular it never declared', () => {
    expect(translateIn(catalogs, 'fr', 'en', 'plural', { count: 1 })).toBe('1 objets');
  });

  it('falls back to the other variant when the plural category has no entry', () => {
    const russian = { en: { apples_other: '{count} apples' }, ru: {} };

    expect(translateIn(russian, 'ru', 'en', 'apples', { count: 3 })).toBe('3 apples');
  });

  it('returns undefined for missing keys', () => {
    expect(translateIn(catalogs, 'en', 'en', 'missing')).toBeUndefined();
  });
});
