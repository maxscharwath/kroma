import { describe, expect, it } from 'vitest';
import { mapPool } from './pool';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('mapPool', () => {
  it('answers in the order it was given, not the order the work finished', async () => {
    const delaysMs = [30, 0, 10];

    const results = await mapPool(delaysMs, 3, async (delayMs, index) => {
      await sleep(delayMs);
      return index;
    });

    expect(results).toEqual([0, 1, 2]);
  });

  it('never has more than the limit in flight at once', async () => {
    const hosts = Array.from({ length: 8 }, (_, index) => `192.168.1.${index + 1}`);
    let inFlight = 0;
    let peak = 0;

    await mapPool(hosts, 3, async (host) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await sleep(1);
      inFlight -= 1;
      return host;
    });

    expect(peak).toBe(3);
  });

  it('runs nothing and answers nothing for an empty list', async () => {
    const hosts: string[] = [];

    const results = await mapPool(hosts, 4, () => Promise.reject(new Error('called')));

    expect(results).toEqual([]);
  });
});
