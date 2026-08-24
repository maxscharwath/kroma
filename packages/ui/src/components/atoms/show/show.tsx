// <Show>: the kit's conditional, so a tree spells "this row only when …" as part
// of its markup instead of a `cond ? … : null`. It renders `children` when
// `when` is truthy, else `fallback` (nothing by default). A branch may be a
// thunk (`() => <A/>`) to build it only when it is taken — the lazy path other
// <If>/<When> helpers lack. Pure and hook-free: one component on the web, on
// Apple TV and on Android TV, and nothing for the React Compiler to trip on.

import type { ReactNode } from 'react';

/** A branch: nodes, or a thunk that builds them only when the branch is taken. */
type Branch = ReactNode | (() => ReactNode);

export interface ShowProps {
  /** Render `children` when truthy, otherwise `fallback`. */
  when: unknown;
  /** Rendered when `when` is falsy. Defaults to nothing. */
  fallback?: Branch;
  children: Branch;
}

function take(branch: Branch): ReactNode {
  if (typeof branch === 'function') return branch();
  return branch;
}

export function Show({ when, fallback = null, children }: Readonly<ShowProps>) {
  return <>{when ? take(children) : take(fallback)}</>;
}
