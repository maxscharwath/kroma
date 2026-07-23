/// <reference path="./types/react-native-tv.d.ts" />
/// <reference path="./types/react-native-web.d.ts" />
// @kroma/ui/kit: the universal component library.
//
// One source of components that renders natively on Apple TV / Android TV
// (React Native) and in the browser on Tizen / webOS / desktop (react-native-web).
// Nothing in here imports react-dom or reaches for the DOM outside a `.web.tsx`
// file, which is the ONLY place the two worlds differ; the bundlers pick per
// target (Metro takes the plain file, Vite the `.web` one).
//
// The package root (`@kroma/ui`) still exports the older DOM-only components the
// browser admin app uses. As screens move over, those disappear and this becomes
// the root. Nothing is duplicated between the two: they are disjoint sets.

export type { Align, BoxStyleProps, Justify, Spacing } from './lib/box-style';
export { boxStyle, color } from './lib/box-style';
export type { Rect } from './lib/cover-rect';
export { coverRect, parsePosition } from './lib/cover-rect';
// ---- cross-platform CSS escape hatches ----
export { bgPosition, bgSize, gradient, promote } from './lib/css';
// The one sanctioned way to ask for the DOM from shared code (null on a TV).
export { webDocument, webWindow } from './lib/dom';
export type { FocusBridgeProps } from './lib/focus-bridge';
export { FocusBridge } from './lib/focus-bridge';
export type { Crossing, Crossings } from './lib/focus-crossings';
export { screenEntry } from './lib/focus-crossings';
export { useFocusNav } from './lib/focus-nav';
export { configureRemote } from './lib/focus-remote';
export type { FocusScopeProps } from './lib/focus-scope';
export { FocusColumn, FocusRegion, FocusScope } from './lib/focus-scope';
export type { FocusScrollProps } from './lib/focus-scroll';
export { FocusRail, FocusScroll, FocusSlot } from './lib/focus-scroll';
export type { FocusEngine, FocusHostProps, FocusNavHandlers } from './lib/focus-types';
export { DEFAULT_ICON_SIZE, DEFAULT_ICON_STROKE, ICON_NAMES } from './lib/glyph';
export type { ImageBackend, ImageBackendProps } from './lib/image-backend';
export { imageBackend, reactNativeImage, setImageBackend } from './lib/image-backend';
// A full-screen overlay takes the remote with this (the brand intro does).
export { clearInputHolds, holdInput, inputHeld } from './lib/input-gate';
export { PageMain } from './lib/landmark';
// ---- hooks ----
export type { LoopKind } from './lib/loop';
export { useLoop } from './lib/loop';
export type { PerfReport } from './lib/perf';
export { perfReport, perfRunning, resetPerf, startPerf, stopPerf } from './lib/perf';
export {
  armPressGuard,
  clearPressGuard,
  PRESS_GUARD_MS,
  pressGuardActive,
} from './lib/press-guard';
export type { ReportCategoryMeta } from './lib/report-categories';
export { REPORT_CATEGORIES } from './lib/report-categories';
export type { RingGeometry, RingProps } from './lib/ring';
export { RING_ROTATION, ringGeometry } from './lib/ring';
export type { CompoundVariant, SvConfig, SvFn, VariantProps } from './lib/sv';
export { sv } from './lib/sv';
export { SvgXml } from './lib/svg';
// ---- design tokens ----
export * from './lib/tokens';
export type { GrowingCount } from './lib/use-growing-count';
export { useGrowingCount } from './lib/use-growing-count';
export type { WheelSpin } from './lib/wheel-paths';
export {
  KROMA_WHEEL_COLORS,
  KROMA_WHEEL_SEGMENTS,
  WHEEL_SPIN_MS,
  WHEEL_VIEWBOX,
} from './lib/wheel-paths';
// ---- components, in two tiers ----
// Primitives are the atoms; molecules are the arrangements the design names.
// Both are re-exported flat, so a consumer writes `import { Button, ListRow }`
// and never has to know which tier something lives in.
export * from './ui/molecules';
export * from './ui/primitives';
// The workbench is NOT re-exported here. It is a tool, not part of the library,
// and it pulls in every story: apps that never open it should never bundle it.
// Import it from '@kroma/ui/workbench', ideally lazily.
