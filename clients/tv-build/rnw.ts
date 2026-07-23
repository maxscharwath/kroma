// react-native-web wiring, shared by every browser target (Tizen, webOS,
// Android TV's WebView shell, the Tauri desktop app and the web client).
//
// @kroma/ui and the screens built on it are authored against React Native.
// On the browser targets that module specifier has to land on react-native-web,
// and `.web.*` files have to win over their native siblings. Those two rules are
// the ENTIRE web/native split: keeping them in one place is what stops the four
// shells from drifting into four slightly different bundler setups.

import type { UserConfig } from 'vite';

/** Extension order. `.web.*` first, mirroring what Metro does in reverse for the
 * native apps (it prefers `.ios` / `.android` / `.native` and never sees these). */
export const WEB_EXTENSIONS = [
  '.web.tsx',
  '.web.ts',
  '.web.jsx',
  '.web.js',
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.json',
  '.mjs',
];

/**
 * Build a shell's `resolve` block. `alias` is the shell's own path aliases (e.g.
 * `#tv`); the react-native redirect is appended last. `extraDedupe` names any
 * further single-instance package the shell needs (the web client adds
 * `react-call`, whose callables keep a module-level store).
 *
 * The redirect is an anchored RegExp on purpose: a plain string alias also
 * matches subpath imports, so `react-native/Libraries/...` would silently become
 * `react-native-web/Libraries/...` and fail to resolve with a confusing error.
 */
export function webResolve(
  alias: Record<string, string> = {},
  extraDedupe: string[] = [],
): UserConfig['resolve'] {
  return {
    alias: [
      ...Object.entries(alias).map(([find, replacement]) => ({ find, replacement })),
      { find: /^react-native$/, replacement: 'react-native-web' },
    ],
    extensions: WEB_EXTENSIONS,
    // bun installs per workspace, so React can otherwise be linked twice (once
    // for the shell, once for a package it depends on) and hooks blow up.
    dedupe: ['react', 'react-dom', 'react-native-web', ...extraDedupe],
  };
}

/** react-native-web is CommonJS and pulls a deep tree; pre-bundling it keeps the
 * dev server's module graph small enough for a TV's slow connection. */
export const RNW_OPTIMIZE_INCLUDE = ['react-native-web'];

/**
 * react-native-web's Animated implementation reads the React Native `global`,
 * which no browser defines: without this, every Animated component throws
 * `ReferenceError: global is not defined` the moment it unmounts and tries to
 * stop its animation. That is the pulsing skeleton, the spinner, the brand
 * wheel, the settings switch and the text caret, so the whole screen goes with
 * them.
 *
 * `globalThis` is the standard spelling of what React Native means by `global`,
 * and it exists on every engine this app ships to, including the Chromium 53
 * legacy webOS tier (it is ES2020, which that tier's build already down-levels).
 */
export const RNW_DEFINE = { global: 'globalThis' };
