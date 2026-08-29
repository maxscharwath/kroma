import type { Plugin } from 'vite';
import { resolveConfig } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kromaI18nDevtools } from './index.ts';

const PROVIDER = '/repo/packages/i18n/src/react/provider.tsx';

function inject(plugin: Plugin, id: string, options?: { ssr: boolean }): string | null {
  if (typeof plugin.transform !== 'function') throw new Error('the plugin lost its transform');
  const result = plugin.transform.call({} as never, 'export const x = 1;', id, options);
  if (result === null || result === undefined || typeof result === 'string') return null;
  return 'code' in result ? (result.code ?? null) : null;
}

function transform(id: string, options?: { ssr: boolean }): string | null {
  return inject(kromaI18nDevtools(), id, options);
}

async function withoutPanel(): Promise<Plugin> {
  vi.doMock('node:module', () => ({
    createRequire: () => ({
      resolve: () => {
        throw new Error('Cannot find module');
      },
    }),
  }));
  vi.doMock('node:fs', () => ({ existsSync: () => false }));
  vi.resetModules();

  const { kromaI18nDevtools: uninstalled } = await import('./index.ts');
  return uninstalled();
}

async function pluginNames(command: 'build' | 'serve'): Promise<string[]> {
  const config = await resolveConfig(
    { configFile: false, plugins: [kromaI18nDevtools()] },
    command,
  );
  return config.plugins.map((plugin) => plugin.name);
}

async function aliases(plugin: Plugin): Promise<Record<string, string>> {
  if (typeof plugin.config !== 'function') throw new Error('the plugin lost its config');
  const config = await plugin.config.call(
    {} as never,
    {},
    { command: 'serve', mode: 'development' },
  );
  const alias = config?.resolve?.alias;
  if (!Array.isArray(alias)) return alias ?? {};
  const found: Record<string, string> = {};
  for (const { find, replacement } of alias as Array<{ find: unknown; replacement: string }>) {
    if (typeof find === 'string') found[find] = replacement;
  }
  return found;
}

afterEach(() => {
  vi.doUnmock('node:fs');
  vi.doUnmock('node:module');
  vi.resetModules();
});

describe('kromaI18nDevtools', () => {
  it('mounts the dev tools from the provider, which every shell renders', () => {
    expect(transform(PROVIDER)).toContain('@kroma/i18n-devtools');
  });

  it('disposes on a hot reload rather than binding the shortcut twice', () => {
    expect(transform(PROVIDER)).toContain('import.meta.hot.dispose');
  });

  it('leaves every other module alone', () => {
    expect(transform('/repo/packages/i18n/src/react/context.ts')).toBeNull();
    expect(transform('/repo/clients/web/src/routes/__root.tsx')).toBeNull();
  });

  it('reaches the provider through the query a dev server appends', () => {
    expect(transform(`${PROVIDER}?t=1735689600000`)).toContain('@kroma/i18n-devtools');
  });

  it('leaves the server pass alone, so a prerender renders the real copy', () => {
    expect(transform(PROVIDER, { ssr: true })).toBeNull();
  });

  it('is dropped by Vite itself on a production build', async () => {
    expect(await pluginNames('serve')).toContain('kroma-i18n-devtools');

    expect(await pluginNames('build')).not.toContain('kroma-i18n-devtools');
  });

  it('resolves the panel itself, since the module it injects into cannot', async () => {
    expect(await aliases(kromaI18nDevtools())).toHaveProperty('@kroma/i18n-devtools');
  });

  it('adds no alias where the panel is not installed beside the shell', async () => {
    expect(await aliases(await withoutPanel())).toEqual({});
  });

  it('injects nothing without the panel, so a shell that lacks it still starts', async () => {
    expect(inject(await withoutPanel(), PROVIDER)).toBeNull();
  });
});

interface Asked {
  event: string;
  data: Record<string, unknown>;
}

function serving(over: { allow?: string[]; transform?: unknown } = {}) {
  const handlers = new Map<string, (data: unknown, client: unknown) => void>();
  const said: Asked[] = [];
  const warned: string[] = [];
  const watching = new Map<string, () => void>();
  const client = {
    send: (event: string, data: Record<string, unknown>) => said.push({ event, data }),
  };
  const server = {
    environments: {
      client: {
        hot: {
          on: (event: string, run: (data: unknown, c: unknown) => void) => handlers.set(event, run),
        },
        transformRequest: () => Promise.resolve(over.transform ?? null),
      },
    },
    config: {
      root: '/repo/clients/web',
      logger: { warn: (line: string) => warned.push(line) },
      server: { fs: { allow: over.allow ?? ['/repo'] } },
    },
    watcher: { on: (event: string, run: () => void) => watching.set(event, run) },
  };
  const plugin = kromaI18nDevtools();
  (plugin.configureServer as (s: unknown) => void).call({} as never, server);
  const ask = async (event: string, data: object) => {
    handlers.get(event)?.(data, client);
    await Promise.resolve();
    await Promise.resolve();
  };
  return { ask, said, warned, watching, handlers };
}

describe('what the panel may ask the dev server', () => {
  it('answers which editors this machine has', async () => {
    const at = serving();

    await at.ask('kroma:i18n:editors', { at: 1 });

    expect(at.said[0]?.event).toBe('kroma:i18n:editors');
    expect(at.said[0]?.data).toMatchObject({ at: 1 });
    expect(Array.isArray(at.said[0]?.data.editors)).toBe(true);
  });

  it('answers where a served line was written, and says nothing without a map', async () => {
    const at = serving();

    await at.ask('kroma:i18n:where', { at: 2, url: '/src/who.tsx', line: 9, column: 1 });

    expect(at.said[0]).toMatchObject({ event: 'kroma:i18n:where', data: { at: 2, line: null } });
  });

  it('refuses to open a file outside the trees it serves', async () => {
    const at = serving({ allow: ['/repo/clients/web'] });

    await at.ask('kroma:i18n:open', { at: 3, file: '/etc/passwd:1:1', editor: '' });

    expect(at.said[0]).toMatchObject({ data: { at: 3, opened: false } });
    expect(at.warned[0]).toContain('refused to open');
  });

  it('refuses a file that is nowhere at all', async () => {
    const at = serving();

    await at.ask('kroma:i18n:open', { at: 4, file: '/repo/nope.tsx:1:1' });

    expect(at.said[0]).toMatchObject({ data: { opened: false } });
  });

  it('forgets what it traced when a file changes', () => {
    const at = serving();

    expect(at.watching.has('change')).toBe(true);
    expect(() => at.watching.get('change')?.()).not.toThrow();
  });
});
