import ExpoModulesCore
import Foundation

/**
 The Apple TV's own CPU and memory counts, for the About screen. Hermes exposes
 no `navigator.hardwareConcurrency` / `navigator.deviceMemory`, so the numbers
 come from ProcessInfo instead - synchronous constants of the running set, so a
 plain `Function` (read on the JS thread) is enough, no promise needed.
 */
public class DeviceHardwareModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DeviceHardware")

    Function("cpuCores") {
      ProcessInfo.processInfo.activeProcessorCount
    }

    // physicalMemory is UInt64; JS numbers are doubles, and RAM sizes are far
    // inside the 2^53 a double holds exactly, so the width is not a concern.
    Function("memoryBytes") {
      Double(ProcessInfo.processInfo.physicalMemory)
    }
  }
}
