import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createI18n } from './i18n';
import type { Catalogs } from './types';

const ADMIN = {
  en: { 'admin.title': 'Console', 'admin.by': 'By $t(brand)' },
  fr: { 'admin.title': 'Console (fr)' },
};

function build(loader: () => Promise<Catalogs<string>> = () => Promise.resolve(ADMIN)) {
  const spy = vi.fn(loader);
  const i18n = createI18n({
    catalogs: {
      en: { brand: 'KROMA', greeting: 'Hi' },
      fr: { greeting: 'Bonjour' },
    },
    defaultLocale: 'en',
    lazy: { admin: spy },
  });
  return { i18n, loader: spy };
}

describe('lazy namespaces', () => {
  it('renders a key as itself until its namespace lands, then translates it', async () => {
    const { i18n } = build();
    const t = i18n.translator('fr');

    const before = t('admin.title');
    await i18n.load('admin');

    expect([before, t('admin.title')]).toEqual(['admin.title', 'Console (fr)']);
  });

  it('starts the fetch on the first miss without being asked', async () => {
    const { i18n, loader } = build();

    i18n.translate('en', 'admin.title');
    await vi.waitFor(() => expect(i18n.translate('en', 'admin.title')).toBe('Console'));

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('fetches a namespace once across concurrent and repeated asks', async () => {
    const { i18n, loader } = build();

    await Promise.all([i18n.load('admin'), i18n.load('admin')]);
    await i18n.load('admin');

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('lets a loaded namespace quote the eager catalogs, through the default locale', async () => {
    const { i18n } = build();

    await i18n.load('admin');

    expect([i18n.translate('en', 'admin.by'), i18n.translate('fr', 'admin.by')]).toEqual([
      'By KROMA',
      'By KROMA',
    ]);
  });

  it('announces the landing so a view re-reads, and answers has() from then on', async () => {
    const { i18n } = build();
    const listener = vi.fn();
    i18n.subscribe(listener);
    const before = i18n.version();

    await i18n.load('admin');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(i18n.version()).toBeGreaterThan(before);
    expect(i18n.has('admin.title')).toBe(true);
  });

  it('leaves a miss outside every lazy namespace alone', () => {
    const { i18n, loader } = build();

    i18n.translate('en', 'nope.x' as 'greeting');
    i18n.translate('en', 'admin' as 'greeting');

    expect(loader).not.toHaveBeenCalled();
  });

  it('rejects a load that fails and does not retry it from a miss', async () => {
    const { i18n, loader } = build(() => Promise.reject(new Error('offline')));

    await expect(i18n.load('admin')).rejects.toThrow('offline');
    i18n.translate('en', 'admin.title');

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('retries a failed namespace when asked explicitly', async () => {
    let attempts = 0;
    const { i18n } = build(() => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(ADMIN);
    });

    await expect(i18n.load('admin')).rejects.toThrow('offline');
    await i18n.load('admin');

    expect(i18n.translate('en', 'admin.title')).toBe('Console');
  });

  it('rejects a namespace it was never given', async () => {
    const { i18n } = build();

    await expect(i18n.load('nope' as 'admin')).rejects.toThrow('no lazy namespace "nope"');
  });

  it('types the keys of a lazy namespace beside the eager ones', () => {
    const i18n = createI18n({
      catalogs: { en: { greeting: 'Hi' } },
      defaultLocale: 'en',
      lazy: { admin: () => Promise.resolve({ en: { 'admin.title': 'Console' } }) },
    });

    expectTypeOf<Parameters<typeof i18n.translate>[1]>().toEqualTypeOf<
      'greeting' | 'admin.title'
    >();
    expectTypeOf<Parameters<typeof i18n.load>[0]>().toEqualTypeOf<'admin'>();
  });
});
