// Entry for the DEEP legacy bundle (Chromium 47, Tizen 3.0): polyfills first,
// then the same app as the modern entry. The tier below the legacy one needs
// nothing the legacy one does not, since core-js installs by feature detection
// and what it does not cover (ResizeObserver) the player already falls back for.
// dist/index.html picks the bundle at runtime.
import '@kroma/bundler/polyfills-legacy';
import './main';
