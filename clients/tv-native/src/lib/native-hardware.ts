// The hardware source: the set's own CPU and memory counts, which a Hermes
// shell has no Web API to read. The native module does the reading (ProcessInfo
// on tvOS, Runtime / ActivityManager on Android TV); this only adapts its two
// functions to the shared port's shape. A build without the module answers null
// on both, and the About rows hide - the same contract the Web probes keep.

import type { HardwareSource } from '@kroma/tv';
import { cpuCores, memoryBytes } from '../../modules/device-hardware';

export const nativeHardware: HardwareSource = { cpuCores, memoryBytes };
