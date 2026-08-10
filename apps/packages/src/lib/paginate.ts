export interface Page<T> {
  items: readonly T[];
  page: number;
  pages: number;
  from: number;
  to: number;
  total: number;
}

/** The slice on screen plus the 1-based range it covers. A page past the end
 *  clamps to the last one, so a list that shrinks under a filter never lands on
 *  nothing. */
export function paginate<T>(items: readonly T[], page: number, size: number): Page<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.trunc(page)), pages);
  const start = (current - 1) * size;
  const slice = items.slice(start, start + size);
  return {
    items: slice,
    page: current,
    pages,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
    total,
  };
}
