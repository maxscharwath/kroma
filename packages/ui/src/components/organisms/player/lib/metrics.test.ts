import { describe, expect, it } from 'vitest';
import { TV_FLAGS, WEB_FLAGS } from '../types';
import {
  CLUSTER_GAP,
  CONTROL_SIZE,
  chromeMetrics,
  GUTTER,
  isTransport,
  MIN_SCALE,
  PANEL_FRACTION,
  PANEL_MAX,
  PANEL_MIN,
  panelGeometry,
  px,
  ROW_GAP,
  TRANSPORT_GAP,
  VOLUME_RAIL,
} from './metrics';
import { controlOrder } from './nav';

const WEB = controlOrder({ ...WEB_FLAGS, cast: true }, true);
const TV = controlOrder(TV_FLAGS, true);

/** The width the row would take at design scale, computed the long way round so
 * the test does not simply restate `chromeMetrics`' own arithmetic. */
function designWidth(controls: readonly ReturnType<typeof controlOrder>[number][]): number {
  const width = (ids: typeof controls, gap: number) =>
    ids.reduce((sum, id) => sum + CONTROL_SIZE[id] + (id === 'volume' ? VOLUME_RAIL : 0), 0) +
    Math.max(0, ids.length - 1) * gap;
  return (
    GUTTER * 2 +
    width(
      controls.filter((id) => isTransport(id)),
      TRANSPORT_GAP,
    ) +
    ROW_GAP * 2 +
    width(
      controls.filter((id) => !isTransport(id)),
      CLUSTER_GAP,
    )
  );
}

describe('chromeMetrics', () => {
  it('draws the design at full size on a television stage', () => {
    expect(chromeMetrics(TV, 1920)).toMatchObject({ scale: 1, compact: false });
    expect(chromeMetrics(WEB, 1920)).toMatchObject({ scale: 1, compact: false });
  });

  it('never scales above the design, however wide the window', () => {
    expect(chromeMetrics(WEB, 5120).scale).toBe(1);
  });

  it('shrinks the row rather than letting the cluster reach the transport', () => {
    const needed = designWidth(WEB);
    const tight = chromeMetrics(WEB, needed - 200);
    expect(tight.scale).toBeLessThan(1);
    expect(tight.scale).toBeGreaterThanOrEqual(MIN_SCALE);
    expect(tight.compact).toBe(false);
    // The whole row still fits the stage it was measured against.
    expect(needed * tight.scale).toBeLessThanOrEqual(needed - 200);
  });

  it('keeps a control set that fits at full size at full size', () => {
    // The same window is comfortable for a TV row and tight for a web one: the
    // scale answers for the controls that are present, not for the platform.
    const width = designWidth(TV) + 10;
    expect(chromeMetrics(TV, width).scale).toBe(1);
    expect(chromeMetrics(WEB, width).scale).toBeLessThan(1);
  });

  it('stacks instead of shrinking past the touch-target floor', () => {
    const phone = chromeMetrics(WEB, 390);
    expect(phone.compact).toBe(true);
    expect(phone.scale).toBe(MIN_SCALE);
    // The floor is what keeps the smallest circle tappable.
    expect(px(phone.scale, CONTROL_SIZE.subtitles)).toBeGreaterThanOrEqual(44);
  });

  it('quantizes the scale so a window drag does not re-lay-out per pixel', () => {
    const needed = designWidth(WEB);
    const steps = new Set<number>();
    for (let w = Math.round(needed * MIN_SCALE); w < needed; w += 1) {
      steps.add(chromeMetrics(WEB, w).scale);
    }
    expect(steps.size).toBeLessThanOrEqual(1 + Math.ceil((1 - MIN_SCALE) / 0.02));
    // ...and every step it does take is a size the row actually fits in.
    for (const scale of steps) expect(scale).toBeGreaterThanOrEqual(MIN_SCALE);
  });

  it('reports the cluster width at the scale it will be drawn at', () => {
    // Against the design's own width rather than a third transcription of the
    // sum: what this asserts is the RULE (whatever the cluster measures, it is
    // reported at the scale it is drawn at), not the arithmetic behind it.
    const design = chromeMetrics(WEB, 1920);
    expect(design.scale).toBe(1);
    const tight = chromeMetrics(WEB, 900);
    expect(tight.scale).toBeLessThan(1);
    expect(tight.clusterWidth).toBe(Math.round(design.clusterWidth * tight.scale));
  });

  it('survives a stage it has not been measured on yet', () => {
    expect(chromeMetrics(WEB, 0)).toMatchObject({ scale: 1, compact: false });
  });
});

describe('panelGeometry', () => {
  it('keeps the design 44% (capped) on a stage with room for it', () => {
    expect(panelGeometry(1920)).toEqual({ width: PANEL_MAX, covers: false });
    expect(panelGeometry(1400).width).toBe(1400 * PANEL_FRACTION);
    expect(panelGeometry(1400).covers).toBe(false);
  });

  it('holds a readable floor rather than shrinking with the stage', () => {
    // 44% of 800 is 352, which set the menu's labels one letter per line.
    expect(panelGeometry(800).width).toBe(PANEL_MIN);
  });

  it('takes the whole stage, and stops shrinking the picture, on a phone', () => {
    const phone = panelGeometry(390);
    expect(phone.width).toBe(390);
    expect(phone.covers).toBe(true);
  });

  it('covers rather than leaving a slit of film beside it', () => {
    // 420 of a 500 stage is a panel with 80px of picture next to it: take it all.
    const narrow = panelGeometry(500);
    expect(narrow.covers).toBe(true);
    expect(narrow.width).toBe(500);
    // A tablet has room for both, so it keeps the panel and the card.
    expect(panelGeometry(834)).toEqual({ width: PANEL_MIN, covers: false });
  });

  it('never overflows the stage it is drawn on', () => {
    for (const width of [320, 390, 500, 700, 834, 1024, 1280, 1920, 3440]) {
      expect(panelGeometry(width).width).toBeLessThanOrEqual(width);
    }
  });

  it('survives a stage it has not been measured on yet', () => {
    expect(panelGeometry(0)).toEqual({ width: PANEL_MAX, covers: false });
  });
});

describe('px', () => {
  it('rounds, so two circles of the same size are the same size', () => {
    expect(px(0.78, 56)).toBe(44);
    expect(px(1, 56)).toBe(56);
  });
});
