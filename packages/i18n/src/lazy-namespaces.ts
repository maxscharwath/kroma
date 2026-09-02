import type { Catalogs } from './types';

/** One loader per namespace fetched on first use rather than shipped up front,
 *  keyed by the prefix it answers: `admin` owns every `admin.*` key. */
export type NamespaceLoaders = Readonly<Record<string, () => Promise<Catalogs<string>>>>;

export class LazyNamespaces<N extends string> {
  private readonly names: ReadonlySet<string>;
  private readonly loading = new Map<string, Promise<void>>();
  private readonly loaded = new Set<string>();
  private readonly failed = new Set<string>();

  constructor(
    private readonly loaders: NamespaceLoaders,
    private readonly extend: (catalogs: Catalogs<string>) => void,
  ) {
    this.names = new Set(Object.keys(loaders));
  }

  load(names: readonly N[]): Promise<void> {
    return Promise.all(names.map((name) => this.loadOne(name))).then(() => undefined);
  }

  /** A key nothing answered. When an unloaded namespace owns it, start the
   *  fetch: the key renders as itself meanwhile and the store's change notice
   *  redraws it. A namespace whose fetch failed is not retried from here, so a
   *  stale chunk cannot turn every render into a request. */
  missed(key: string): void {
    const name = key.slice(0, key.indexOf('.'));
    if (!this.names.has(name) || this.loaded.has(name) || this.failed.has(name)) return;
    this.loadOne(name).catch(() => undefined);
  }

  private loadOne(name: string): Promise<void> {
    if (this.loaded.has(name)) return Promise.resolve();
    const pending = this.loading.get(name);
    if (pending) return pending;
    const loader = this.loaders[name];
    if (!loader) return Promise.reject(new Error(`no lazy namespace "${name}"`));
    this.failed.delete(name);
    const started = loader().then(
      (catalogs) => {
        this.extend(catalogs);
        this.loaded.add(name);
        this.loading.delete(name);
      },
      (error: unknown) => {
        this.failed.add(name);
        this.loading.delete(name);
        throw error;
      },
    );
    this.loading.set(name, started);
    return started;
  }
}
