import { expect, it } from 'vitest';
import type { KromaClient } from './kroma-client';
import { BEARER, recordRequest } from './kroma-client.fixture';

/** One endpoint, as the request it must make. `path` is what follows `/api`,
 * already encoded; `body` is checked only when the row states one. */
export interface Endpoint {
  readonly name: string;
  readonly call: (client: KromaClient) => unknown;
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
  /** A `public` endpoint sends no `Authorization`; every other one carries the
   * session bearer. */
  readonly auth?: 'public';
}

/** One `it` per endpoint, checking the verb, the resolved path, the bearer and
 * the body of the request it makes. */
export function checkEndpoints(endpoints: readonly Endpoint[]): void {
  it.each(endpoints)('$name', async ({ call, method, path, body, auth }) => {
    const recorded = await recordRequest(call);

    expect(recorded.method).toBe(method);
    expect(recorded.path).toBe(path);
    expect(recorded.headers.get('Authorization')).toBe(
      auth === 'public' ? null : `Bearer ${BEARER}`,
    );
    if (body !== undefined) expect(recorded.body).toEqual(body);
  });
}
