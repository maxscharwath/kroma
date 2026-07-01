// Framework-agnostic heartbeat loop behind `useServerHealth`. Kept free of React
// so the state machine (cadence, offline/online edges, reconnect firing, probe
// coalescing) is unit-testable with fake timers see healthMonitor.test.ts.

export interface HealthMonitorOptions {
  /** One reachability check: resolves `true` if the server answered, `false`
   * otherwise. Must not reject (the caller wraps failures into `false`). */
  probe: () => Promise<boolean>;
  /** Fired whenever reachability flips (never on an unchanged probe). */
  onChange: (online: boolean) => void;
  /** Fired on each offline→online edge, after `onChange(true)`. */
  onReconnect?: () => void;
  /** Cadence while the server answers. Default 8000ms. */
  onlineMs?: number;
  /** Cadence while it doesn't (faster, for a snappy reconnect). Default 3000ms. */
  offlineMs?: number;
  /** Assumed reachability before the first probe resolves. Default `true`. */
  initialOnline?: boolean;
}

export interface HealthMonitor {
  /** Probe now instead of waiting for the next tick (no-op while one is running). */
  recheck: () => void;
  /** Stop the loop; no further probes, callbacks or timers. */
  stop: () => void;
}

/**
 * Poll `probe()` on a self-adjusting timer: slowly while online, quickly while
 * offline. Reports flips via `onChange` and offline→online recoveries via
 * `onReconnect`. A single in-flight guard keeps `recheck()` from spawning a
 * second parallel loop. Probes immediately on start.
 */
export function startHealthMonitor(opts: HealthMonitorOptions): HealthMonitor {
  const onlineMs = opts.onlineMs ?? 8000;
  const offlineMs = opts.offlineMs ?? 3000;
  let online = opts.initialOnline ?? true;
  let stopped = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const mark = (up: boolean) => {
    if (stopped || up === online) return;
    online = up;
    opts.onChange(up);
    if (up) opts.onReconnect?.();
  };

  const schedule = () => {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(run, online ? onlineMs : offlineMs);
  };

  async function run(): Promise<void> {
    if (stopped || inFlight) return;
    inFlight = true;
    try {
      mark(await opts.probe());
    } catch {
      mark(false);
    } finally {
      inFlight = false;
      schedule();
    }
  }

  void run();

  return {
    recheck: () => {
      if (stopped || inFlight) return;
      clearTimeout(timer);
      void run();
    },
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
