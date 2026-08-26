import { describe, expect, it } from 'vitest';
import { createI18n } from './i18n';

const catalogs = {
  en: { 'lang.en': 'English', greeting: 'Hi', item: '{count} items', item_one: '{count} item' },
  fr: { 'lang.fr': 'Français', greeting: 'Bonjour' },
};
const i18n = createI18n(catalogs, 'en');

describe('createI18n', () => {
  it('translates, pluralises and falls back to the default locale', () => {
    expect(i18n.translate('fr', 'greeting')).toBe('Bonjour');
    expect(i18n.translate('en', 'item', { count: 1 })).toBe('1 item');
    expect(i18n.translate('fr', 'item', { count: 5 })).toBe('5 items');
  });

  it('returns the key itself when no catalog knows it', () => {
    expect(i18n.translate('en', 'nope' as 'greeting')).toBe('nope');
  });

  it('binds a locale', () => {
    const t = i18n.createTranslator('fr');

    expect(t('greeting')).toBe('Bonjour');
  });

  it('translates against catalogs handed in at runtime', () => {
    const extra = { en: { late: 'Late' }, fr: { late: 'Tard' } };

    expect(i18n.translateIn(extra, 'fr', 'late')).toBe('Tard');
    expect(i18n.translateIn(extra, 'fr', 'absent')).toBeUndefined();
  });
});
