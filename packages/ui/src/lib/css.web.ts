// Web half of css.ts: react-native-web passes these straight through to CSS
// under their standard names, with no `experimental_` prefix.

import type { ViewStyle } from 'react-native';

export function gradient(css: string): ViewStyle {
  return { backgroundImage: css } as ViewStyle;
}

export function bgPosition(value: string): ViewStyle {
  return { backgroundPosition: value } as ViewStyle;
}

export function bgSize(value: string): ViewStyle {
  return { backgroundSize: value } as ViewStyle;
}

/** Give this view its own GPU layer, so an animation near it does not force it
 * to re-rasterize. `translateZ(0)` is the portable "own texture"; `willChange`
 * keeps the layer alive between animations instead of paying to rebuild it. See
 * css.ts for when this is worth it (and when it is not). */
export function promote(): ViewStyle {
  return { transform: 'translateZ(0)', willChange: 'transform' } as unknown as ViewStyle;
}
