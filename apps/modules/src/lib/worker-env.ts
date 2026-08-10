type Ambient = { env?: Record<string, string>; waitUntil?: (p: Promise<unknown>) => void };

/**
 * The worker's env and `waitUntil`, for code reached through the SSR handler
 * rather than through `machineResponse` (which is handed both).
 *
 * `cloudflare:workers` only exists inside workerd. Off it — `vite dev`, and the
 * build's own render of the site — the ambient environment is the process's, so
 * that is what stands in; an empty env there means every such render is an
 * anonymous fetch, which GitHub answers with 403 once the shared IP is over the
 * limit. The cache write is awaited rather than dropped because workerd may
 * cancel unregistered work once the response is sent, which would leave the
 * edge cache unpopulated and every render hitting GitHub again.
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
    return { env: processEnv(), waitUntil: (p) => void p.catch(() => {}) };
  }
}

function processEnv(): Record<string, string> {
  const ambient = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  if (!ambient?.env) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(ambient.env)) if (value !== undefined) out[key] = value;
  return out;
}
