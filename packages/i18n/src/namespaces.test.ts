import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { createI18n } from './i18n';
import type { Catalog } from './types';

const ADMIN = {
  en: { 'admin.title': 'Console', 'admin.by': 'By $t(admin.brand)', 'admin.brand': 'KROMA' },
  fr: { 'admin.title': 'Console (fr)', 'admin.brand': 'KROMA' },
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function build() {
  const loads = {
    en: vi.fn(() => Promise.resolve(ADMIN.en)),
    fr: vi.fn(() => Promise.resolve(ADMIN.fr)),
  };
  const i18n = createI18n({
    catalogs: { en: { greeting: 'Hi' }, fr: { greeting: 'Bonjour' } },
    defaultLocale: 'en',
    lazy: { admin: loads },
  });
  return { i18n, loads };
}

describe('a namespace a chunk registers', () => {
  it('is fetched for the warmed locale only, and suspends that locale until it lands', async () => {
    const { i18n, loads } = build();
    i18n.warm('fr');

    i18n.register('admin', loads);
    const pending = i18n.pending('fr');

    expect(pending).toBeInstanceOf(Promise);
    expect(i18n.pending('en')).toBeNull();
    await pending;
    expect([i18n.translate('fr', 'admin.title' as 'greeting'), loads.en.mock.calls.length]).toEqual(
      ['Console (fr)', 0],
    );
    expect(i18n.pending('fr')).toBeNull();
  });

  it('is fetched for a locale warmed later, and hands the same promise back while in flight', async () => {
    const { i18n } = build();
    i18n.register('admin', { en: () => Promise.resolve(ADMIN.en) });

    i18n.warm('en');
    const first = i18n.pending('en');
    const second = i18n.pending('en');

    expect(first).toBe(second);
    await first;
    expect(i18n.translate('en', 'admin.title' as 'greeting')).toBe('Console');
  });

  it('lands at once when given the catalog itself', () => {
    const { i18n } = build();

    i18n.register('admin', { en: ADMIN.en });

    expect(i18n.translate('en', 'admin.by' as 'greeting')).toBe('By KROMA');
    expect(i18n.pending('en')).toBeNull();
  });

  it('announces the landing so a view re-reads', async () => {
    const { i18n, loads } = build();
    const listener = vi.fn();
    i18n.subscribe(listener);
    i18n.warm('en');

    i18n.register('admin', loads);
    await i18n.pending('en');

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('a namespace only the folder offers', () => {
  it('is not fetched by warming, only by a miss, and in the missed locale alone', async () => {
    const { i18n, loads } = build();
    i18n.warm('fr');

    expect(loads.fr).not.toHaveBeenCalled();
    const before = i18n.translate('fr', 'admin.title' as 'greeting');
    await vi.waitFor(() =>
      expect(i18n.translate('fr', 'admin.title' as 'greeting')).toBe('Console (fr)'),
    );

    expect(before).toBe('admin.title' as 'greeting');
    expect([loads.fr.mock.calls.length, loads.en.mock.calls.length]).toEqual([1, 0]);
  });

  it('is fetched once per locale across concurrent and repeated asks', async () => {
    const { i18n, loads } = build();

    await Promise.all([i18n.load('admin'), i18n.load('admin')]);
    await i18n.load('admin');

    expect([loads.en.mock.calls.length, loads.fr.mock.calls.length]).toEqual([1, 1]);
  });

  it('leaves a miss outside every namespace alone', () => {
    const { i18n, loads } = build();

    i18n.translate('en', 'nope.x' as 'greeting');

    expect(loads.en).not.toHaveBeenCalled();
  });

  it('does not retry a failed fetch from a miss, but does when asked outright', async () => {
    let attempts = 0;
    const flaky = () => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error('offline')) : Promise.resolve(ADMIN.en);
    };
    const i18n = createI18n({
      catalogs: { en: { greeting: 'Hi' } },
      defaultLocale: 'en',
      lazy: { admin: { en: flaky } },
    });

    await expect(i18n.load('admin')).rejects.toThrow('offline');
    i18n.translate('en', 'admin.title' as 'greeting');
    expect(attempts).toBe(1);

    await i18n.load('admin');
    expect(i18n.translate('en', 'admin.title' as 'greeting')).toBe('Console');
  });

  it('rejects a namespace it was never given', async () => {
    const { i18n } = build();

    await expect(i18n.load('nope' as 'admin')).rejects.toThrow('no namespace "nope"');
  });
});

describe('pending', () => {
  it('settles even when a fetch fails, so a suspended tree renders again', async () => {
    const gate = deferred<Catalog>();
    const i18n = createI18n({
      catalogs: { en: { greeting: 'Hi' } },
      defaultLocale: 'en',
    });
    i18n.warm('en');
    i18n.register('nav', { en: () => gate.promise.then(() => Promise.reject(new Error('gone'))) });
    const pending = i18n.pending('en');

    gate.resolve({});
    await pending;

    expect(i18n.pending('en')).toBeNull();
    expect(i18n.translate('en', 'nav.home' as 'greeting')).toBe('nav.home');
  });
});

describe('types', () => {
  it('come from the default locale catalog handed in', () => {
    const i18n = createI18n({
      catalogs: { en: { greeting: 'Hi' }, fr: { greeting: 'Bonjour', extra: 'x' } },
      defaultLocale: 'en',
    });

    expectTypeOf<Parameters<typeof i18n.translate>[1]>().toEqualTypeOf<'greeting'>();
    expectTypeOf<Parameters<typeof i18n.translate>[0]>().toEqualTypeOf<'en' | 'fr'>();
  });
});
