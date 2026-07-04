// Desktop auto-update. On launch (and every few hours while running) the app asks
// its GitHub Release for a newer signed build, installs it in the background, then
// relaunches. Silent by design, a 10-foot / TV-style app has no update dialog, so
// failures (offline, no Tauri context in a browser dev run) are logged, not shown.
//
// The update is verified against the pubkey pinned in tauri.conf.json, so only
// builds signed with our private key (a CI secret) are ever installed. On macOS the
// updater-installed bundle is NOT quarantined, so updates open with no Gatekeeper
// prompt even though the first download is unsigned.
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

async function runOnce(): Promise<void> {
  try {
    const update = await check();
    if (!update) return;
    console.log(`[updater] update available: ${update.version}, installing…`);
    await update.downloadAndInstall();
    console.log('[updater] installed, relaunching');
    await relaunch();
  } catch (err) {
    // Offline, no release yet, or not running inside Tauri (browser dev): ignore.
    console.warn('[updater] check failed:', err);
  }
}

/** Start the background updater: check now, then on a fixed interval. */
export function startUpdater(): void {
  void runOnce();
  setInterval(() => void runOnce(), CHECK_INTERVAL_MS);
}
