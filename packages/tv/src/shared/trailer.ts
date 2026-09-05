import type { ItemId, KromaClient, TrailerReady } from '@kroma/core';

/** The copy takes seconds, so this is a spinner's cadence, not a long poll. */
const POLL_MS = 1000;
const GIVE_UP_MS = 5 * 60 * 1000;

/** Starts the local copy and resolves once it can actually be streamed. `prepare`
 * is idempotent, so each poll joins the copy already running. */
export async function awaitTrailer(
  client: KromaClient,
  id: ItemId,
  sleep: (ms: number) => Promise<void> = wait,
  now: () => number = Date.now,
): Promise<TrailerReady> {
  const deadline = now() + GIVE_UP_MS;
  for (;;) {
    const ready = await client.media.prepareTrailer(id);
    if (ready.state === 'ready') return ready;
    if (now() >= deadline) throw new Error('trailer is taking too long');
    await sleep(POLL_MS);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
