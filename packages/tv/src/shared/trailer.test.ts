import type { ItemId, KromaClient, TrailerReady } from '@kroma/core';
import { describe, expect, it, vi } from 'vitest';
import { awaitTrailer } from './trailer';

const ID = 'm1' as ItemId;

function clip(over: Partial<TrailerReady> = {}): TrailerReady {
  return {
    language: 'fr',
    key: 'abc',
    durationMs: 120_000,
    container: 'mp4',
    video: null,
    state: 'ready',
    percent: 100,
    ...over,
  };
}

function client(answers: TrailerReady[]) {
  const prepareTrailer = vi.fn(async () => answers.shift() ?? clip());
  return { client: { media: { prepareTrailer } } as unknown as KromaClient, prepareTrailer };
}

const instant = () => Promise.resolve();

describe('awaiting a trailer the server is still fetching', () => {
  it('polls until the copy can actually be streamed', async () => {
    const { client: c, prepareTrailer } = client([
      clip({ state: 'preparing', percent: 0 }),
      clip({ state: 'preparing', percent: 61 }),
      clip(),
    ]);

    const ready = await awaitTrailer(c, ID, instant);

    expect(ready.state).toBe('ready');
    expect(prepareTrailer).toHaveBeenCalledTimes(3);
  });

  it('asks once when the copy is already here', async () => {
    const { client: c, prepareTrailer } = client([clip()]);

    await awaitTrailer(c, ID, instant);

    expect(prepareTrailer).toHaveBeenCalledTimes(1);
  });

  it('gives up rather than polling a copy that never lands', async () => {
    const stuck = { media: { prepareTrailer: async () => clip({ state: 'preparing' }) } };
    let now = 0;

    await expect(
      awaitTrailer(stuck as unknown as KromaClient, ID, instant, () => (now += 60_000)),
    ).rejects.toThrow(/too long/);
  });
});
