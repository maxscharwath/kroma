// JS face of the set's own hardware counts, for the About screen: the numbers a
// Hermes shell has no Web API to read (`navigator.hardwareConcurrency`,
// `navigator.deviceMemory`). Both native platforms ship it, so this is not
// optional the way Siri or the launcher are; but a build without the module
// still yields null rather than throwing, and the About row simply hides.

import { type NativeModule, requireOptionalNativeModule } from 'expo';

declare class DeviceHardwareNativeModule extends NativeModule {
  // Logical CPU cores the OS reports for this set.
  cpuCores(): number;
  // Physical RAM in bytes; the port turns it into the coarse GB the row shows.
  memoryBytes(): number;
}

const native = requireOptionalNativeModule<DeviceHardwareNativeModule>('DeviceHardware');

export function cpuCores(): number | null {
  return native ? native.cpuCores() : null;
}

export function memoryBytes(): number | null {
  return native ? native.memoryBytes() : null;
}
