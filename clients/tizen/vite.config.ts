import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { tvFrame } from '../tv-frame.vite';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

// Supported TV floor: Chrome 99 (Tizen 8 / webOS 24, 2024+ models). Tailwind v4
// requires cascade layers (Chrome 99) so that is the hard minimum; Lightning CSS
// then down-levels the remaining modern CSS (color-mix(), oklch()) that only
// landed in Chrome 111 to plain fallbacks. Version encoding: major << 16.
const TV_CSS_TARGETS = { chrome: 99 << 16 };

// On-device live-dev: with LUMA_TV_DEVICE=1 the shell is served over the LAN so a
// real TV can load it and get full Vite HMR (see scripts/dev-device.sh + the
// `make dev-shell` target). It turns off the desktop letterbox frame (the panel is
// already 1080p) and keeps console.* in the output so on-TV logs still reach dlog.
const deviceDev = process.env.LUMA_TV_DEVICE === '1';

// This machine's LAN IPv4 the TV connects back to for the HMR websocket. Must match
// the address baked into the installed dev shell, so LUMA_TV_HOST (set by
// dev-device.sh from scripts/lan-ip.sh) wins; the first-non-internal-v4 scan is only
// a fallback for running device mode without that env (then it can differ).
function lanIp(): string | undefined {
  if (process.env.LUMA_TV_HOST) return process.env.LUMA_TV_HOST;
  return Object.values(networkInterfaces())
    .flatMap((addrs) => addrs ?? [])
    .find((a) => a.family === 'IPv4' && !a.internal)?.address;
}

export default defineConfig(({ command }) => ({
  // `tvFrame()` is dev-only (apply: 'serve') it letterboxes the app into a
  // 1920×1080 16:9 stage in the browser; never injected into `vite build` output.
  // On a real TV (deviceDev) the panel already is that canvas, so no frame.
  plugins: [tailwindcss(), react(), tvFrame({ enabled: !deviceDev })],
  // `#tv/*` → the @luma/tv package src (mirrors tsconfig.base paths; Vite needs it explicitly).
  resolve: { alias: { '#tv': fileURLToPath(new URL('../../packages/tv/src', import.meta.url)) } },
  // Packaged TV apps load from a local path assets must be referenced relatively.
  base: './',
  server: {
    // deviceDev: bind 0.0.0.0 so the TV on the LAN can reach the dev server, and
    // point the HMR socket at this machine's LAN IP (the TV is a different host).
    host: deviceDev ? true : undefined,
    port: 5174,
    hmr: deviceDev ? { host: lanIp(), protocol: 'ws' } : undefined,
    fs: { allow: [repoRoot] },
  },
  optimizeDeps: { exclude: ['@luma/ui', '@luma/core', '@luma/tv'] },
  // Down-level Tailwind v4's modern CSS (cascade layers, color-mix, oklch) to plain
  // fallbacks for old TV webviews. Fonts load via <link> in index.html so no remote
  // @import reaches the transformer.
  css: {
    transformer: 'lightningcss',
    lightningcss: { targets: TV_CSS_TARGETS },
  },
  // Tizen 8+ webview (Chromium 108+, 2024 models) modern target, lean output.
  build: {
    target: 'es2020',
    outDir: 'dist',
    // One JS + one CSS file: fewer round-trips on a TV's slow connection.
    cssCodeSplit: false,
    cssMinify: 'lightningcss',
    modulePreload: { polyfill: false },
    reportCompressedSize: true,
    rollupOptions: { output: { manualChunks: undefined } },
  },
  // Strip logging/comments from shipped bundles only keep console.* during dev so
  // on-TV logs still surface in dlog / the LAN log collector.
  esbuild: {
    drop: command === 'build' ? ['console', 'debugger'] : [],
    legalComments: 'none',
  },
}));
