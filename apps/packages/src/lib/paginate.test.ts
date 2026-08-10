import { describe, expect, it } from 'vitest';
import { paginate } from './paginate';

const rows = Array.from({ length: 34 }, (_, i) => `r${i}`);

describe('paginate', () => {
  it('slices the page and reports the range it covers', () => {
    const page = paginate(rows, 1, 25);
    expect(page.items).toHaveLength(25);
    expect([page.from, page.to, page.total, page.pages]).toEqual([1, 25, 34, 2]);
  });

  it('reports the tail of the list on the last page', () => {
    const page = paginate(rows, 2, 25);
    expect(page.items[0]).toBe('r25');
    expect([page.from, page.to]).toEqual([26, 34]);
  });

  it('clamps a page beyond the end and below the start', () => {
    expect(paginate(rows, 9, 25).page).toBe(2);
    expect(paginate(rows, 0, 25).page).toBe(1);
  });

  it('answers an empty list with one empty page', () => {
    const page = paginate([], 1, 25);
    expect(page.pages).toBe(1);
    expect([page.from, page.to, page.total]).toEqual([0, 0, 0]);
  });
});
