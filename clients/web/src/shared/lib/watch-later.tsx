// "Watch later": the user's to-watch queue, hydrated once and shared across
// the detail toggle and cards. Server-backed, with optimistic toggles that
// revert if the call fails.

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '#web/shared/lib/auth';

interface WatchLaterValue {
  ready: boolean;
  ids: readonly string[];
  inQueue: (id: string) => boolean;
  setInQueue: (id: string, inQueue: boolean) => void;
  toggle: (id: string) => void;
}

const WatchLaterContext = createContext<WatchLaterValue | null>(null);

function revertMembership(id: string, wasAdding: boolean) {
  return (prev: readonly string[]): readonly string[] => {
    if (wasAdding) return prev.filter((x) => x !== id);
    return prev.includes(id) ? prev : [id, ...prev];
  };
}

export function WatchLaterProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { client, user, ready: authReady } = useAuth();
  const [ids, setIds] = useState<readonly string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setIds([]);
      setReady(true);
      return;
    }
    let cancelled = false;
    setReady(false);
    client
      .watchLater()
      .then((list) => {
        if (!cancelled) {
          setIds(list);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [client, user, authReady]);

  const setInQueue = useCallback(
    (id: string, inQueue: boolean) => {
      if (!user) return;
      setIds((prev) => {
        if (prev.includes(id) === inQueue) return prev;
        return inQueue ? [id, ...prev] : prev.filter((x) => x !== id);
      });
      const call = inQueue ? client.addToWatchLater(id) : client.removeFromWatchLater(id);
      call.catch(() => {
        setIds(revertMembership(id, inQueue));
      });
    },
    [client, user],
  );

  const value = useMemo<WatchLaterValue>(() => {
    const set = new Set(ids);
    return {
      ready,
      ids,
      inQueue: (id) => set.has(id),
      setInQueue,
      toggle: (id) => setInQueue(id, !set.has(id)),
    };
  }, [ids, ready, setInQueue]);

  return <WatchLaterContext.Provider value={value}>{children}</WatchLaterContext.Provider>;
}

/** Throws if used outside `<WatchLaterProvider>`. */
export function useWatchLater(): WatchLaterValue {
  const ctx = useContext(WatchLaterContext);
  if (!ctx) throw new Error('useWatchLater must be used within <WatchLaterProvider>');
  return ctx;
}
