// Live hardware of the set this client is running on, for the About screen.
//
// Every value is a Web API a TV webview may simply not have: Chromium exposes
// `navigator.deviceMemory` and `performance.memory`, most engines expose
// `hardwareConcurrency`, and a native (Hermes) shell exposes none of them. Each
// probe answers null when its API is missing so the row hides rather than shows
// a zero, and never throws - an absent API is the normal case here.
//
// A native shell has no such Web API but does have the numbers, so it injects a
// `HardwareSource` at module scope (see `setHardwareSource`); when one is set it
// wins, otherwise the browser reads below stand unchanged.

export interface ClientHardware {
  /** Logical CPU cores, or null where the engine will not say. */
  cpuCores: number | null;
  /** Device memory in GB (Chromium's coarse `deviceMemory`, else the JS heap
   * limit), or null where neither is reported. */
  memoryGb: number | null;
}

/** A shell's own way to the numbers the Web APIs will not give it. Both answer
 * null when the platform withholds the value, exactly like the probes below;
 * memory is bytes, converted to GB here so the source stays engine-agnostic. */
export interface HardwareSource {
  cpuCores(): number | null;
  memoryBytes(): number | null;
}

let source: HardwareSource | null = null;

/** Call once at the app root, before the first render; null removes it. */
export function setHardwareSource(src: HardwareSource | null): void {
  source = src;
}

export function clientHardware(): ClientHardware {
  return { cpuCores: readCpuCores(), memoryGb: readMemoryGb() };
}

interface DeviceNavigator {
  hardwareConcurrency?: number;
  deviceMemory?: number;
}

interface HeapMemory {
  jsHeapSizeLimit?: number;
}

const BYTES_PER_GB = 1024 ** 3;

function readCpuCores(): number | null {
  const injected = fromSource((s) => s.cpuCores());
  if (injected !== null) return injected;
  const nav = globalThis.navigator as DeviceNavigator | undefined;
  return positive(nav?.hardwareConcurrency);
}

function readMemoryGb(): number | null {
  const injected = fromSource((s) => s.memoryBytes());
  if (injected !== null) return Math.round(injected / BYTES_PER_GB) || null;
  const nav = globalThis.navigator as DeviceNavigator | undefined;
  const device = positive(nav?.deviceMemory);
  if (device) return device;
  const perf = globalThis.performance as (Performance & { memory?: HeapMemory }) | undefined;
  const limit = positive(perf?.memory?.jsHeapSizeLimit);
  return limit ? Math.round(limit / BYTES_PER_GB) || null : null;
}

// A source that is set but throws counts as no answer, so the Web reads below
// still run rather than the row taking the screen down.
function fromSource(read: (s: HardwareSource) => number | null): number | null {
  if (!source) return null;
  try {
    return positive(read(source));
  } catch {
    return null;
  }
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
