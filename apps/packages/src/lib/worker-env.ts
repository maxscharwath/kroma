type Ambient = { env?: Record<string, string>; waitUntil?: (p: Promise<unknown>) => void };

/**
 * The worker's env and `waitUntil`, for code reached through the SSR handler
 * rather than through `machineResponse` (which is handed both).
 *
 * `cloudflare:workers` only exists inside workerd, so `vite dev` falls back to
 * an anonymous fetch and an awaited cache write. Awaiting rather than dropping
 * the promise matters: workerd may cancel unregistered work once the response
 * is sent, which would leave the edge cache unpopulated and every render
 * hitting GitHub again.
 */
export async function workerContext(): Promise<{
  env: Record<string, string>;
  waitUntil: (p: Promise<unknown>) => void;
}> {
  try {
    const mod = (await import(/* @vite-ignore */ 'cloudflare:workers')) as Ambient;
    const waitUntil = mod.waitUntil;
    return {
      env: mod.env ?? {},
      waitUntil: typeof waitUntil === 'function' ? waitUntil : (p) => void p.catch(() => {}),
    };
  } catch {
    return { env: {}, waitUntil: (p) => void p.catch(() => {}) };
  }
}
