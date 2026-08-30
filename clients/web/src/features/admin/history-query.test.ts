import { describe, expect, it } from 'vitest';
import { historyRequest, validateHistorySearch } from './history-query';

describe("the watch history's address", () => {
  it('asks for everything the log holds when no window is named', () => {
    expect(historyRequest(validateHistorySearch({})).days).toBe(0);
  });

  it('applies the library, the account and the window it arrived with', () => {
    const search = validateHistorySearch({ library: 'lib-1', user: 'u-7', range: '7d' });

    expect(historyRequest(search)).toMatchObject({ library: 'lib-1', user: 'u-7', days: 7 });
  });

  it('drops a window nobody offers', () => {
    expect(validateHistorySearch({ range: 'fortnight' }).range).toBeUndefined();
  });

  it('drops a column the table cannot order by', () => {
    expect(validateHistorySearch({ sort: 'network', dir: 'asc' }).sort).toBeUndefined();
  });

  it('leaves the first page out of the address', () => {
    expect(validateHistorySearch({ page: 1 }).page).toBeUndefined();
  });

  it('names the column and the direction the server orders by', () => {
    expect(historyRequest(validateHistorySearch({ sort: 'title', dir: 'asc' })).sort).toBe(
      'title:asc',
    );
  });

  it('reads most recent first until a column is picked', () => {
    expect(historyRequest({}).sort).toBe('endedAt:desc');
  });

  it('turns a page number into the offset of its first row', () => {
    expect(historyRequest({ page: 3 })).toMatchObject({ limit: 50, offset: 100 });
  });

  it('narrows to one title without dropping the other filters', () => {
    const search = validateHistorySearch({ item: 'show-4', user: 'u-7' });

    expect(historyRequest(search)).toMatchObject({ item: 'show-4', user: 'u-7' });
  });
});
