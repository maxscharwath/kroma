// Deep legacy tier (Chromium 47), imported FIRST by the shell's main.deep.ts.
// Everything the ordinary legacy tier needs, plus ResizeObserver: it is Chrome
// 64, so the 2021+ sets the legacy tier actually reaches have it natively and
// polyfills-legacy never had to carry it.
import '@kroma/bundler/polyfills-legacy';
import ResizeObserver from 'resize-observer-polyfill';

const view = globalThis as { ResizeObserver?: unknown };
if (typeof view.ResizeObserver === 'undefined') view.ResizeObserver = ResizeObserver;
