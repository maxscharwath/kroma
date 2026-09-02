import type { LocaleCatalog, NamespaceCatalogs } from './announce';
import { namespaceOf } from './layout';
import type { Catalog } from './types';

interface Entry {
  readonly sources: Map<string, LocaleCatalog>;
  readonly loaded: Set<string>;
  readonly loading: Map<string, Promise<void>>;
  readonly failed: Set<string>;
  needed: boolean;
}

/**
 * Which namespaces exist, where each locale's catalog comes from, and which of
 * them have landed. A namespace a chunk announced is `needed`: its catalog for
 * every warmed locale is fetched at once. One only the folder glob offered is
 * fetched when a key of it misses.
 */
export class Namespaces {
  private readonly entries = new Map<string, Entry>();
  private readonly warmed = new Set<string>();
  private readonly pendingByLocale = new Map<string, Promise<void>>();

  constructor(private readonly extend: (locale: string, catalog: Catalog) => void) {}

  announce(namespace: string, catalogs: NamespaceCatalogs, needed: boolean): void {
    const entry = this.entry(namespace);
    for (const [locale, source] of Object.entries(catalogs)) {
      if (typeof source === 'function') {
        if (!entry.loaded.has(locale)) entry.sources.set(locale, source);
        continue;
      }
      this.extend(locale, source);
      this.settle(namespace, locale);
    }
    entry.needed ||= needed;
    if (entry.needed) for (const locale of this.warmed) this.ensure(namespace, locale);
  }

  /** A locale's catalog for `namespace` is already in the store. */
  settle(namespace: string, locale: string): void {
    const entry = this.entry(namespace);
    entry.loaded.add(locale);
    entry.loading.delete(locale);
    entry.sources.delete(locale);
    entry.failed.delete(locale);
  }

  /** From now on, fetch every needed namespace's catalog for `locale`. */
  warm(locale: string): void {
    if (this.warmed.has(locale)) return;
    this.warmed.add(locale);
    for (const [namespace, entry] of this.entries) {
      if (entry.needed) this.ensure(namespace, locale);
    }
  }

  /** Everything in flight for `locale`, as one promise a component can suspend
   *  on, or `null` when nothing is. The same promise is handed back until it
   *  settles, which is what `use()` needs to resume. */
  pending(locale: string): Promise<void> | null {
    const inFlight = [...this.entries.values()].flatMap((entry) => {
      const loading = entry.loading.get(locale);
      return loading ? [loading] : [];
    });
    if (inFlight.length === 0) {
      this.pendingByLocale.delete(locale);
      return null;
    }
    const held = this.pendingByLocale.get(locale);
    if (held) return held;
    const all: Promise<void> = Promise.all(inFlight).then(
      () => this.forget(locale, all),
      () => this.forget(locale, all),
    );
    this.pendingByLocale.set(locale, all);
    return all;
  }

  /** Fetch `namespaces` for every locale each has a source for. */
  load(namespaces: readonly string[]): Promise<void> {
    const started = namespaces.flatMap((namespace) => {
      const entry = this.entries.get(namespace);
      if (!entry) return [Promise.reject(new Error(`no namespace "${namespace}"`))];
      return [...entry.sources.keys()].map(
        (locale) => this.ensure(namespace, locale) ?? Promise.resolve(),
      );
    });
    return Promise.all(started).then(() => undefined);
  }

  /** A key nothing answered in `locale`: fetch its namespace for that locale,
   *  unless a fetch already failed. */
  missed(key: string, locale: string): void {
    const namespace = namespaceOf(key);
    const entry = this.entries.get(namespace);
    if (!entry || entry.failed.has(locale)) return;
    this.ensure(namespace, locale)?.catch(() => undefined);
  }

  private ensure(namespace: string, locale: string): Promise<void> | null {
    const entry = this.entry(namespace);
    if (entry.loaded.has(locale)) return null;
    const inFlight = entry.loading.get(locale);
    if (inFlight) return inFlight;
    const source = entry.sources.get(locale);
    if (typeof source !== 'function') return null;
    entry.failed.delete(locale);
    const started = source().then(
      (catalog) => {
        this.extend(locale, catalog);
        this.settle(namespace, locale);
      },
      (error: unknown) => {
        entry.failed.add(locale);
        entry.loading.delete(locale);
        throw error;
      },
    );
    entry.loading.set(locale, started);
    return started;
  }

  private forget(locale: string, promise: Promise<void>): void {
    if (this.pendingByLocale.get(locale) === promise) this.pendingByLocale.delete(locale);
  }

  private entry(namespace: string): Entry {
    let entry = this.entries.get(namespace);
    if (!entry) {
      entry = {
        sources: new Map(),
        loaded: new Set(),
        loading: new Map(),
        failed: new Set(),
        needed: false,
      };
      this.entries.set(namespace, entry);
    }
    return entry;
  }
}
