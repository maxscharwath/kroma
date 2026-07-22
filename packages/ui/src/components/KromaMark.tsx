import type { CSSProperties } from 'react';
import { KROMA_WHEEL_COLORS, KROMA_WHEEL_SEGMENTS, WHEEL_VIEWBOX } from '../brand/wheelPaths';

// Geometry and palette live in ../brand/wheel so the universal <Wheel> and this
// DOM-only mark cannot drift apart.
export { KROMA_WHEEL_COLORS, KROMA_WHEEL_SEGMENTS };

// Spin lives on the <svg> element itself (the wheel is centred in its viewBox),
// not on an inner group: `transform-box: fill-box` is missing on old TV webviews.
const SPIN_CSS = `@keyframes kroma-wheel-spin{to{transform:rotate(360deg)}}
.kroma-wheel-idle{animation:kroma-wheel-spin 9s linear infinite}
.kroma-wheel-loading{animation:kroma-wheel-spin 2.6s linear infinite}
@media (prefers-reduced-motion:reduce){.kroma-wheel-idle,.kroma-wheel-loading{animation:none}}`;

export type KromaMarkSpin = 'idle' | 'loading';

export interface KromaMarkProps {
  /** Width/height of the wheel; a number is px, a string passes through (e.g. ".66em"). */
  size?: number | string;
  /** Continuous rotation: "idle" (9s, ambient) or "loading" (2.6s, spinner). */
  spin?: KromaMarkSpin;
  style?: CSSProperties;
}

/** The KROMA chromatic wheel the standalone brand symbol and the O of the wordmark. */
export function KromaMark({ size = 24, spin, style }: Readonly<KromaMarkProps>) {
  const svg = (
    <svg
      width={size}
      height={size}
      viewBox={WHEEL_VIEWBOX}
      aria-hidden="true"
      className={spin ? `kroma-wheel-${spin}` : undefined}
      style={style}
    >
      {KROMA_WHEEL_SEGMENTS.map((d, i) => (
        <path key={d} d={d} fill={KROMA_WHEEL_COLORS[i]} />
      ))}
    </svg>
  );
  if (!spin) return svg;
  return (
    <>
      <style>{SPIN_CSS}</style>
      {svg}
    </>
  );
}
