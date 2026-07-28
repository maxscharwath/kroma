// How the player chrome fits itself to the stage it is drawn on.
//
// The chrome was drawn for a 1920 television, where a 62 / 80 / 62 transport and
// eight 56px cluster circles have room to spare. A browser window is whatever
// the user made it: at 1280 the cluster already reaches back into the transport,
// and the fixed-size circles simply drew ON TOP of each other, because nothing
// in the row was allowed to shrink.
//
// So the row's sizes are DERIVED from the space there actually is, against the
// controls that are actually present (a film with no next episode and no live
// receiver is two circles narrower, and gets to stay full-size for longer).
// Every number below is at design scale; `chromeMetrics` returns the multiplier
// the chrome draws them at.

import type { ControlId } from './nav';

/** Diameter of every control circle, at design scale (§4). */
export const CONTROL_SIZE: Record<ControlId, number> = {
  rewind: 62,
  play: 80,
  forward: 62,
  next: 56,
  volume: 56,
  subtitles: 56,
  audio: 56,
  settings: 56,
  cast: 56,
  pip: 56,
  fullscreen: 56,
};

/** The volume pill's rail, which sits beside its mute button inside one pill. */
export const VOLUME_RAIL = 96;
/** Gap between the transport keys, and between the cluster circles (§4). */
export const TRANSPORT_GAP = 20;
export const CLUSTER_GAP = 14;
/** The chrome's side gutters (top bar and bottom chrome share them). */
export const GUTTER = 34;
/** The least space allowed between the transport and the cluster: the point at
 * which they stop being two groups and start being one crowded row. */
export const ROW_GAP = 24;

/** The transport keys, which sit centred; everything else is the right cluster. */
const TRANSPORT: ReadonlySet<ControlId> = new Set<ControlId>(['rewind', 'play', 'forward']);

export const isTransport = (id: ControlId): boolean => TRANSPORT.has(id);

/**
 * The floor the chrome may shrink to.
 *
 * Set by the smallest control rather than by taste: 56 × 0.78 ≈ 44, the smallest
 * comfortable touch target. Below this the row stops shrinking and stacks
 * instead - a smaller circle would be a button nobody can hit.
 */
export const MIN_SCALE = 0.78;

/**
 * The scale is quantized to this step. Two reasons, both real: <Box>'s shared
 * style cache is keyed on the shorthand values, so a scale that varies per pixel
 * of window width would mint a cache entry per pixel while a window is dragged;
 * and a row that re-lays-out on every one of those pixels reads as jitter rather
 * than as a resize.
 */
const STEP = 0.02;

export interface ChromeMetrics {
  /** Multiplier for every size in the chrome (1 = the design's own scale). */
  scale: number;
  /** Too narrow for one row: the cluster stacks under the transport and wraps
   *  within itself, so no control is ever dropped or drawn over another. */
  compact: boolean;
  /** The cluster's content width at `scale`. Handed to the cluster box as its
   *  minimum, so flexbox takes the space out of the centring spacer instead of
   *  out of the buttons - which is what made them overlap. */
  clusterWidth: number;
}

/** Width of one row of controls: their diameters (plus the volume rail, which
 * rides inside the volume pill) and the gaps between them. */
function rowWidth(ids: readonly ControlId[], gap: number): number {
  const controls = ids.reduce(
    (sum, id) => sum + CONTROL_SIZE[id] + (id === 'volume' ? VOLUME_RAIL : 0),
    0,
  );
  return controls + Math.max(0, ids.length - 1) * gap;
}

/** Round to the quantization step, and away from float noise (0.02 × 39 is not
 * 0.78 in binary floating point). */
function quantize(scale: number): number {
  return Math.round(Math.floor(scale / STEP) * STEP * 100) / 100;
}

/**
 * What the control row costs at design scale, and therefore how much the chrome
 * has to give up to fit `stageWidth`.
 *
 * Three outcomes, in order of how much room there is:
 *  - it fits: scale 1, and the transport sits dead centre while the spacer and
 *    the cluster share what is left equally;
 *  - it nearly fits: everything shrinks together, and the transport drifts left
 *    of centre as the cluster claims its minimum;
 *  - it does not fit at all (a phone-width browser): `compact`, where the
 *    cluster moves under the transport and wraps.
 */
export function chromeMetrics(controls: readonly ControlId[], stageWidth: number): ChromeMetrics {
  const transport = rowWidth(controls.filter(isTransport), TRANSPORT_GAP);
  const cluster = rowWidth(
    controls.filter((id) => !isTransport(id)),
    CLUSTER_GAP,
  );
  // Two row gaps, not one: the outer row's gap falls on both sides of the
  // transport (spacer | transport | cluster), which is also what keeps the
  // transport exactly centred while there is room for it to be.
  const needed = GUTTER * 2 + transport + ROW_GAP * 2 + cluster;
  const fit = stageWidth > 0 && needed > 0 ? stageWidth / needed : 1;
  const scale = fit >= 1 ? 1 : Math.max(MIN_SCALE, quantize(fit));
  // The cluster's width is ALWAYS reported at the scale it will be drawn at, so
  // that rule lives in one place rather than once per outcome.
  return { scale, compact: fit < MIN_SCALE, clusterWidth: Math.round(cluster * scale) };
}

/** A size at the chrome's current scale. Integers: a 43.68px circle beside a
 * 43.68px circle is two different roundings in the browser's hands. */
export function px(scale: number, size: number): number {
  return Math.round(size * scale);
}

/** What every part of the chrome measures with. */
export type Px = (size: number) => number;

/** `px` bound to one scale, which is how the parts actually use it: each is
 * handed a scale once and then asks for sizes. Here rather than written out in
 * every part, so there is one rounding rule and not five. */
export const scaler =
  (scale: number): Px =>
  (size) =>
    px(scale, size);

/** The settings panel's share of a stage that has room for it (§5). */
export const PANEL_FRACTION = 0.44;
export const PANEL_MAX = 720;
/**
 * The width below which the panel stops being readable.
 *
 * Its rows are an icon, a label and a value on one line; 44% of a phone-width
 * browser is 170px, which set every label one letter per line. Below this it
 * takes the whole stage instead - it is a full screen on a small screen, which
 * is what every other player does there too.
 */
export const PANEL_MIN = 420;

export interface PanelGeometry {
  /** The panel's width in px. */
  width: number;
  /** It leaves too little beside it to be worth shrinking the picture into, so
   *  it covers the stage and the video stays where it is (which is already what
   *  happens behind a native plane). */
  covers: boolean;
}

/** Where the settings panel sits on this stage, and whether the video still has
 * somewhere to shrink to beside it. */
export function panelGeometry(stageWidth: number): PanelGeometry {
  if (stageWidth <= 0) return { width: PANEL_MAX, covers: false };
  const share = Math.min(stageWidth * PANEL_FRACTION, PANEL_MAX);
  // Its share of the stage, but never narrower than it can be read at.
  const wanted = Math.max(share, PANEL_MIN);
  // Four fifths of the stage: what is left beside it could not hold a picture
  // worth looking at, so it takes the whole thing rather than leave a slit of
  // film down one side - and the video stays where it is.
  const covers = wanted >= stageWidth * 0.8;
  return { width: covers ? stageWidth : wanted, covers };
}
