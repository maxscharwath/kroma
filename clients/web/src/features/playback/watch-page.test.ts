import { describe, expect, it } from 'vitest';
import { trailerSearch } from './watch-page';

describe('trailerSearch', () => {
  it('reads the old trailer query as a trailer play', () => {
    expect(trailerSearch({ trailer: true })).toEqual({ trailer: true });
    expect(trailerSearch({ trailer: 'true' })).toEqual({ trailer: true });
    expect(trailerSearch({ trailer: '1' })).toEqual({ trailer: true });
  });

  it('leaves a movie watch without a trailer query', () => {
    expect(trailerSearch({})).toEqual({});
    expect(trailerSearch({ trailer: 'false' })).toEqual({});
  });
});
