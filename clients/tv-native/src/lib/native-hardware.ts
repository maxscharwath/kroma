import type { HardwareSource } from '@kroma/tv';
import { cpuCores, memoryBytes } from '../../modules/device-hardware';

export const nativeHardware: HardwareSource = { cpuCores, memoryBytes };
