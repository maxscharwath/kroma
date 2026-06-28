// "Ma liste" — a client-side set of item ids the user has bookmarked, scoped per
// (server, user) in localStorage. There is no server feature for this yet; the
// provider keeps the detail toggle and the Ma liste grid consistent across the
// app (shared state, persisted across launches).

import { normalizeServerUrl as norm } from '@luma/core';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '#tv/auth';

const storageKey = (serverUrl?: string, userId?: string) =>
  serverUrl && userId ? `luma.mylist.${norm(serverUrl)}.${userId}` : null;

function load(key: string | null): Set<string> {
  if (!key) return new Set();
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function save(key: string, ids: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...ids]));
  } catch {
    /* quota / disabled storage — non-fatal */
  }
}

interface MyList {
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  ids: Set<string>;
}

const Ctx = createContext<MyList | null>(null);

export function MyListProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { session } = useAuth();
  const key = storageKey(session?.serverUrl, session?.user.id);
  const [ids, setIds] = useState<Set<string>>(() => load(key));

  useEffect(() => setIds(load(key)), [key]);

  const toggle = useCallback(
    (id: string) =>
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        if (key) save(key, next);
        return next;
      }),
    [key],
  );

  const value = useMemo<MyList>(() => ({ has: (id) => ids.has(id), toggle, ids }), [ids, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMyList(): MyList {
  const c = useContext(Ctx);
  if (!c) throw new Error('useMyList() must be used inside <MyListProvider>');
  return c;
}
