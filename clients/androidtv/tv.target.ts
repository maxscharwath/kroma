import type { TvTarget } from '../tv-build/shell';

// Android TV / Google TV (incl. Chromecast with Google TV, Nvidia Shield).
// Modern tier only: the Android System WebView is updatable via Play, so the
// Chrome 99 floor covers devices in practice; playback never depends on the
// WebView anyway (native media3/ExoPlayer plane behind it). Flip on
// `legacyChrome` like webOS if stuck-WebView devices ever show up.
export const target: TvTarget = {
  platform: 'androidtv',
  port: 5176,
};
