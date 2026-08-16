// Live hardware of the set this client is running on, for the About screen.
//
// Every value is a Web API a TV webview may simply not have: Chromium exposes
// `navigator.deviceMemory` and `performance.memory`, most engines expose
// `hardwareConcurrency`, and a native (Hermes) shell exposes none of them. Each
// probe answers null when its API is missing so the row hides rather than shows
// a zero, and never throws - an absent API is the normal case here.

export interface ClientHardware {
  /** Logical CPU cores, or null where the engine will not say. */
  cpuCores: number | null;
  /** Device memory in GB (Chromium's coarse `deviceMemory`, else the JS heap
   * limit), or null where neither is reported. */
  memoryGb: number | null;
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
  const nav = globalThis.navigator as DeviceNavigator | undefined;
  return positive(nav?.hardwareConcurrency);
}

function readMemoryGb(): number | null {
  const nav = globalThis.navigator as DeviceNavigator | undefined;
  const device = positive(nav?.deviceMemory);
  if (device) return device;
  const perf = globalThis.performance as (Performance & { memory?: HeapMemory }) | undefined;
  const limit = positive(perf?.memory?.jsHeapSizeLimit);
  return limit ? Math.round(limit / BYTES_PER_GB) || null : null;
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}
