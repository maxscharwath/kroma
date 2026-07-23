// CSS features React Native supports under an `experimental_` prefix (native)
// but that react-native-web exposes under their plain CSS name. See css.web.ts.
//
// Keeping the prefix difference behind these three helpers is what lets every
// gradient in the app stay a single CSS string in a single source file, instead
// of a CSS value on the web and a <LinearGradient> component on native.

import type { ViewStyle } from 'react-native';

/** A CSS `background-image` value, e.g. `linear-gradient(158deg, #a 0%, #b 72%)`. */
export function gradient(css: string): ViewStyle {
  return { experimental_backgroundImage: css };
}

/** A CSS `background-position` value, e.g. `50% 28%`. */
export function bgPosition(value: string): ViewStyle {
  return { experimental_backgroundPosition: value };
}

/** A CSS `background-size` value, e.g. `cover`. */
export function bgSize(value: string): ViewStyle {
  return { experimental_backgroundSize: value };
}

/**
 * Promote a view to its own compositing layer.
 *
 * A no-op on native, where the OS compositor already decides layers and RN has
 * no `will-change`; the web half turns it into `translateZ(0)` + `will-change`.
 * Use it sparingly and only where measured: a promoted layer costs GPU memory,
 * and the win is specifically for a view that would otherwise be re-rasterized
 * by an animation happening near it (a full-screen gradient above a fading
 * backdrop - see AmbientBackdrop).
 */
export function promote(): ViewStyle {
  return {};
}
