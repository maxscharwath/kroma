import { expect, it } from 'vitest';
import type { KromaClient } from './kroma-client';
import { BEARER, recordRequest } from './kroma-client.fixture';

interface Endpoint {
  readonly name: string;
  readonly call: (client: KromaClient) => unknown;
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
  readonly auth?: 'public';
}

/** One `it` per endpoint, checking the request it makes: the verb, `path`
 * (what follows `/api`, encoded), the bearer every row but a `public` one
 * carries, and `body` where the row states one. */
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
