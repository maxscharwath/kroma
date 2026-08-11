import { afterEach, describe, expect, it, vi } from 'vitest';
import server from './server';

const ctx = () => ({ waitUntil: vi.fn() });

const req = (path: string, init?: RequestInit) =>
  new Request(`https://packages.kroma.tv${path}`, init);

const release = {
  tag_name: 'v1.2.3',
  name: 'KROMA 1.2.3',
  draft: false,
  prerelease: false,
  published_at: '2026-07-01T00:00:00Z',
  html_url: 'https://github.com/o/r/releases/v1.2.3',
  assets: [
    {
      name: 'kroma-1.2.3-3439372-x86_64.spk',
      size: 1024,
      browser_download_url: 'https://dl/kroma-1.2.3-3439372-x86_64.spk',
    },
  ],
};

function ghServing() {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify([release]), { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the worker entry', () => {
  it('answers a machine route itself, without rendering a page', async () => {
    const calls = ghServing();
    const res = await server.fetch(req('/ping'), {}, ctx());
    expect(await res.text()).toBe('pong');
    expect(calls).toEqual([]);
  });

  it('threads its env through to the catalog the feed is built from', async () => {
    const calls = ghServing();
    const res = await server.fetch(req('/catalog.json'), { GITHUB_REPO: 'someone/fork' }, ctx());
    const body = (await res.json()) as { packages: { version: string }[] };
    expect(body.packages[0]?.version).toBe('1.2.3-3439372');
    expect(calls[0]).toBe('https://api.github.com/repos/someone/fork/releases?per_page=100');
  });

  it('sends a browser at the root on to the browsable list', async () => {
    ghServing();
    const res = await server.fetch(req('/', { headers: { accept: 'text/html' } }), {}, ctx());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://packages.kroma.tv/browse');
  });
});
