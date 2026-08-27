import { resolveConfig } from 'vite';
import { describe, expect, it } from 'vitest';
import { kromaI18nDevtools } from './index.ts';

const PROVIDER = '/repo/packages/i18n/src/react/provider.tsx';

function transform(id: string, options?: { ssr: boolean }): string | null {
  const plugin = kromaI18nDevtools();
  if (typeof plugin.transform !== 'function') throw new Error('the plugin lost its transform');
  const result = plugin.transform.call({} as never, 'export const x = 1;', id, options);
  if (result === null || result === undefined || typeof result === 'string') return null;
  return 'code' in result ? (result.code ?? null) : null;
}

async function pluginNames(command: 'build' | 'serve'): Promise<string[]> {
  const config = await resolveConfig(
    { configFile: false, plugins: [kromaI18nDevtools()] },
    command,
  );
  return config.plugins.map((plugin) => plugin.name);
}

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
});
