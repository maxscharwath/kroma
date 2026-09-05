import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { kromaAtomic } from './index.ts';

const REPO = resolve(fileURLToPath(new URL('../../../..', import.meta.url)));

const SOURCE =
  "import { styles } from '#ui/core';\nexport const s = styles({ a: { opacity: 0.5 } });";

function plugin(command: 'serve' | 'build' = 'build') {
  const atomic = kromaAtomic({ repoRoot: REPO });
  atomic.configResolved({ command });
  return atomic;
}

const context = () => ({ info: vi.fn(), warn: vi.fn() });

describe('kromaAtomic', () => {
  it('compiles a workspace source module and nothing else', () => {
    const atomic = plugin();
    const ctx = context();

    const inside = atomic.transform.call(ctx, SOURCE, `${REPO}/packages/ui/src/probe.ts?v=1`);
    expect(inside?.code).toContain('__kromaStatic(');
    expect(atomic.transform.call(ctx, SOURCE, `${REPO}/packages/ui/src/probe.test.ts`)).toBeNull();
    expect(atomic.transform.call(ctx, SOURCE, `${REPO}/node_modules/x/index.ts`)).toBeNull();
    expect(atomic.transform.call(ctx, SOURCE, '/elsewhere/probe.ts')).toBeNull();
    expect(atomic.transform.call(ctx, SOURCE, `${REPO}/packages/ui/src/probe.css`)).toBeNull();
  });

  it('lands its sheet after Vite has emitted the stylesheet', () => {
    expect(plugin().generateBundle.order).toBe('post');
  });

  it('lands the sheet in the token stylesheet of a build', () => {
    const atomic = plugin();
    const ctx = context();
    atomic.transform.call(ctx, SOURCE, `${REPO}/packages/ui/src/probe.ts`);
    const bundle = {
      'assets/kroma-abc.css': {
        type: 'asset',
        fileName: 'assets/kroma-abc.css',
        source: ':root{--kroma-bg:#0a0a0c}',
      },
      'assets/other.css': { type: 'asset', fileName: 'assets/other.css', source: '.x{}' },
      'index.js': { type: 'chunk', fileName: 'index.js' },
    };

    atomic.generateBundle.handler.call(ctx, {}, bundle);

    expect(bundle['assets/kroma-abc.css'].source).toMatch(
      /^:root\{--kroma-bg:#0a0a0c\}\n\.r-[\w-]+\{opacity:0\.5;\}\n$/,
    );
    expect(bundle['assets/other.css'].source).toBe('.x{}');
    expect(ctx.warn).not.toHaveBeenCalled();
  });

  it('lands in a token stylesheet that arrives minified, as bytes', () => {
    const atomic = plugin();
    const ctx = context();
    atomic.transform.call(ctx, SOURCE, `${REPO}/packages/ui/src/probe.ts`);
    const bundle = {
      'style.css': {
        type: 'asset',
        fileName: 'style.css',
        source: new TextEncoder().encode(':root{--kroma-bg:#0a0a0c}'),
      },
    };

    atomic.generateBundle.handler.call(ctx, {}, bundle);

    expect(bundle['style.css'].source).toMatch(/^:root\{--kroma-bg:#0a0a0c\}\n\.r-/);
  });

  it('warns when a build has no token stylesheet to land in', () => {
    const atomic = plugin();
    const ctx = context();
    atomic.transform.call(ctx, SOURCE, `${REPO}/packages/ui/src/probe.ts`);

    atomic.generateBundle.handler.call(
      ctx,
      {},
      { 'index.js': { type: 'chunk', fileName: 'index.js' } },
    );

    expect(ctx.warn).toHaveBeenCalledWith(expect.stringContaining('no token stylesheet'));
  });

  it('stays quiet in a server build, whose client carries the sheet', () => {
    const atomic = plugin();
    const ctx = { ...context(), environment: { config: { consumer: 'server' } } };
    atomic.transform.call(ctx, SOURCE, `${REPO}/packages/ui/src/probe.ts`);

    atomic.generateBundle.handler.call(ctx, {}, {});

    expect(ctx.warn).not.toHaveBeenCalled();
  });

  it('injects on the dev server instead of writing a sheet', () => {
    const atomic = plugin('serve');

    const out = atomic.transform.call(context(), SOURCE, `${REPO}/packages/ui/src/probe.ts`);

    expect(out?.code).toContain('__kromaInject([[3,');
  });
});
