import { ModuleRegistry } from '@kroma/module-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Intercept the dynamic MF runtime import so the tests never touch the real one.
vi.mock('@module-federation/runtime', () => ({
  init: vi.fn(),
  registerRemotes: vi.fn(),
  loadRemote: vi.fn(),
}));

import * as mfRuntime from '@module-federation/runtime';
import { forgetRemote, isLoadedRemote, loadRuntimeRemotes } from './remotes';

const WIN = { location: { origin: 'http://localhost:3000' } };

function stubFetch(impl: (url: string) => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => impl(url)),
  );
}

function stubBrowserGlobals() {
  vi.stubGlobal('window', WIN);
  vi.stubGlobal('document', {
    createElement: () => ({ dataset: {} }) as unknown,
    head: { appendChild: () => undefined },
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.mocked(mfRuntime.loadRemote).mockReset();
  vi.mocked(mfRuntime.registerRemotes).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isLoadedRemote / forgetRemote', () => {
  it('reports false for a never-loaded module (mfName maps dots to underscores)', () => {
    expect(isLoadedRemote('tv.kroma.ghost')).toBe(false);
  });

  it('forgetRemote is a no-op for an unknown id', () => {
    expect(() => forgetRemote('tv.kroma.ghost')).not.toThrow();
  });
});

describe('loadRuntimeRemotes (deterministic branches)', () => {
  it('is a no-op during SSR (no window)', async () => {
    // window is not stubbed here => typeof window === "undefined".
    const reg = new ModuleRegistry();
    await expect(loadRuntimeRemotes(reg)).resolves.toEqual([]);
  });

  it('returns [] when discovery throws', async () => {
    stubBrowserGlobals();
    stubFetch(() => {
      throw new Error('network down');
    });
    await expect(loadRuntimeRemotes(new ModuleRegistry())).resolves.toEqual([]);
  });

  it('returns [] when /api/modules is not OK', async () => {
    stubBrowserGlobals();
    stubFetch(() => new Response('nope', { status: 500 }));
    await expect(loadRuntimeRemotes(new ModuleRegistry())).resolves.toEqual([]);
  });

  it('returns [] when no installed module ships a feRemote', async () => {
    stubBrowserGlobals();
    stubFetch(
      () =>
        new Response(JSON.stringify([{ id: 'tv.kroma.plain', enabled: true }]), { status: 200 }),
    );
    await expect(loadRuntimeRemotes(new ModuleRegistry())).resolves.toEqual([]);
  });

  it('skips a disabled module that ships a feRemote', async () => {
    stubBrowserGlobals();
    stubFetch(
      () =>
        new Response(
          JSON.stringify([{ id: 'tv.kroma.off', enabled: false, feRemote: { module: './P' } }]),
          { status: 200 },
        ),
    );
    await expect(loadRuntimeRemotes(new ModuleRegistry())).resolves.toEqual([]);
  });
});

describe('loadRuntimeRemotes (federation path)', () => {
  it('registers a runtime remote and returns its id', async () => {
    stubBrowserGlobals();
    stubFetch(
      () =>
        new Response(
          JSON.stringify([{ id: 'runtimeDemo', enabled: true, feRemote: { module: './Widget' } }]),
          { status: 200 },
        ),
    );
    vi.mocked(mfRuntime.loadRemote).mockResolvedValue({
      default: { id: 'runtimeDemo', version: '1.0.0' },
    });

    const reg = new ModuleRegistry();
    const added = await loadRuntimeRemotes(reg);
    expect(added).toEqual(['runtimeDemo']);
    expect(reg.has('runtimeDemo')).toBe(true);
    expect(isLoadedRemote('runtimeDemo')).toBe(true);
    expect(mfRuntime.registerRemotes).toHaveBeenCalled();

    forgetRemote('runtimeDemo');
    expect(isLoadedRemote('runtimeDemo')).toBe(false);
  });

  it('rolls back a remote whose deps do not resolve', async () => {
    stubBrowserGlobals();
    stubFetch(
      () =>
        new Response(
          JSON.stringify([{ id: 'runtimeBad', enabled: true, feRemote: { module: './P' } }]),
          { status: 200 },
        ),
    );
    vi.mocked(mfRuntime.loadRemote).mockResolvedValue({
      default: { id: 'runtimeBad', version: '1.0.0', dependsOn: { nope: '*' } },
    });

    const reg = new ModuleRegistry();
    const added = await loadRuntimeRemotes(reg);
    expect(added).toEqual([]);
    expect(reg.has('runtimeBad')).toBe(false);
    expect(isLoadedRemote('runtimeBad')).toBe(false); // freed for a later retry
  });

  it('returns [] when a remote fails to load', async () => {
    stubBrowserGlobals();
    stubFetch(
      () =>
        new Response(
          JSON.stringify([{ id: 'runtimeErr', enabled: true, feRemote: { module: './P' } }]),
          { status: 200 },
        ),
    );
    vi.mocked(mfRuntime.loadRemote).mockRejectedValue(new Error('boom'));

    const reg = new ModuleRegistry();
    await expect(loadRuntimeRemotes(reg)).resolves.toEqual([]);
    expect(isLoadedRemote('runtimeErr')).toBe(false);
  });
});
