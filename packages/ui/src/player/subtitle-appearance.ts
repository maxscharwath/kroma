import { type CSSProperties, useCallback, useEffect, useState } from 'react';

/**
 * Subtitle appearance (§8): size, colour, edge treatment, font and opacity, with
 * a live preview. Shared by web + TV and persisted to localStorage so a viewer's
 * choice follows them across sessions and platforms on the same device.
 */

export type SubSize = 'sm' | 'md' | 'lg' | 'xl';
export type SubEdge = 'shadow' | 'box' | 'outline' | 'none';
export type SubFont = 'sans' | 'serif' | 'mono';

export interface SubtitleAppearance {
  size: SubSize;
  color: string;
  edge: SubEdge;
  font: SubFont;
  /** Text opacity, 20–100 (§8). */
  opacity: number;
  /** Background box opacity 0–100 (only used when edge = 'box'). */
  bgOpacity: number;
}

export const DEFAULT_SUB_APPEARANCE: SubtitleAppearance = {
  size: 'md',
  color: '#FFFFFF',
  edge: 'shadow',
  font: 'sans',
  opacity: 100,
  bgOpacity: 75,
};

/** Swatch palette (§8): white, yellow, blue, amber, pink. */
export const SUB_COLORS = ['#FFFFFF', '#F5E050', '#6FA8FF', '#F4B642', '#F58CC0'];

const SIZE_PX: Record<SubSize, number> = { sm: 26, md: 36, lg: 48, xl: 62 };

const FONT_STACK: Record<SubFont, string> = {
  sans: "'Hanken Grotesk', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'SF Mono', ui-monospace, 'Courier New', monospace",
};

const KEY = 'kroma.subtitleStyle';

/** Persisted subtitle appearance. SSR-safe: starts from defaults (matching the
 * server render), then hydrates from localStorage on the client. */
export function useSubtitleAppearance(): [
  SubtitleAppearance,
  (next: Partial<SubtitleAppearance>) => void,
] {
  const [style, setStyle] = useState<SubtitleAppearance>(DEFAULT_SUB_APPEARANCE);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setStyle({ ...DEFAULT_SUB_APPEARANCE, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const update = useCallback((next: Partial<SubtitleAppearance>) => {
    setStyle((prev) => {
      const merged = { ...prev, ...next };
      try {
        localStorage.setItem(KEY, JSON.stringify(merged));
      } catch {
        /* ignore */
      }
      return merged;
    });
  }, []);

  return [style, update];
}

/** Compute the inline CSS for a subtitle text span from the appearance. */
export function subtitleCss(style: SubtitleAppearance): CSSProperties {
  const css: CSSProperties = {
    color: style.color,
    fontSize: SIZE_PX[style.size],
    fontWeight: 600,
    lineHeight: 1.3,
    fontFamily: FONT_STACK[style.font],
    whiteSpace: 'pre-line',
    display: 'inline-block',
    borderRadius: 10,
    opacity: Math.max(0.2, Math.min(1, style.opacity / 100)),
    padding: style.edge === 'box' ? '4px 16px' : undefined,
  };
  if (style.edge === 'shadow') {
    css.textShadow = '0 2px 10px rgba(0,0,0,.92), 0 0 3px rgba(0,0,0,.95)';
  } else if (style.edge === 'outline') {
    css.textShadow =
      '-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 2px 6px rgba(0,0,0,.7)';
  } else if (style.edge === 'box') {
    css.background = `rgba(0,0,0,${Math.max(0, Math.min(100, style.bgOpacity)) / 100})`;
  }
  return css;
}
