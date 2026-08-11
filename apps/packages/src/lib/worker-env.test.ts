import { afterAll, describe, expect, it } from 'vitest';
import { workerContext } from './worker-env';

const PROBE = 'KROMA_PACKAGE_SOURCE_PROBE';

process.env[PROBE] = 'ambient';

afterAll(() => {
  delete process.env[PROBE];
});

describe('workerContext', () => {
  it('stands in the ambient process environment when there is no workerd', async () => {
    const { env } = await workerContext();
    expect(env[PROBE]).toBe('ambient');
  });

  it('hands back one env object, so a cache keyed on its identity can hit', async () => {
    const first = await workerContext();
    const second = await workerContext();
    expect(second.env).toBe(first.env);
  });

  it('reads the environment once, so a later binding change does not leak in', async () => {
    process.env[`${PROBE}_LATE`] = 'late';
    const { env } = await workerContext();
    delete process.env[`${PROBE}_LATE`];
    expect(env[`${PROBE}_LATE`]).toBeUndefined();
  });

  it('swallows a background failure rather than leaving it unhandled', async () => {
    const { waitUntil } = await workerContext();
    const seen: unknown[] = [];
    const onUnhandled = (err: unknown) => {
      seen.push(err);
    };
    process.on('unhandledRejection', onUnhandled);

    waitUntil(Promise.reject(new Error('cache put failed')));
    await new Promise((resolve) => setTimeout(resolve, 10));

    process.off('unhandledRejection', onUnhandled);
    expect(seen).toEqual([]);
  });
});
