import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';

import { TvApp, type TvAppProps } from '#tv/app/TvApp';

// A search asked for from outside the app: Siri on Apple TV today, and the door
// any other shell (a paired phone, a launcher tile) would come through.
export { requestSearch } from '#tv/app/searchRequest';
// The search field and keyboard, when the platform's own are the better pair
// (Apple TV, where they are also the only way in for dictation).
export type { SearchShell, SearchShellProps } from '#tv/app/searchShell';
export { setSearchShell } from '#tv/app/searchShell';
export type { TvAppProps } from '#tv/app/TvApp';
export { TvApp } from '#tv/app/TvApp';
// Voice search is a capability only a shell can supply (see the module): the
// native clients register one, the browser shells have none today.
export type { VoiceSearchBackend, VoiceSessionProps } from '#tv/app/voiceSearch';
export { setVoiceSearchBackend } from '#tv/app/voiceSearch';

/** Loaded on demand: the workbench carries every story in the design system, and
 * an app that is not being inspected should not pay for them. */
const Workbench = lazy(async () => ({
  default: (await import('@kroma/ui/workbench')).Workbench,
}));

/** `?workbench` opens the design system's component atelier instead of the app:
 * every primitive, its variant matrix, and live controls. It renders from the
 * same kit the app does, on whatever target you opened it on, so it is both the
 * fastest way to see a token change land everywhere and the surface the
 * visual-regression screenshots capture. */
function wantsWorkbench(): boolean {
  if (typeof location === 'undefined') return false;
  const params = new URLSearchParams(location.search);
  return params.has('workbench') || params.has('shot');
}

/** Mount the shared TV experience into #root. Called by each platform shell. */
export function mountTv(props: TvAppProps = {}): void {
  const el = document.getElementById('root');
  if (!el) throw new Error('KROMA TV: #root element not found');
  createRoot(el).render(
    <StrictMode>
      {wantsWorkbench() ? (
        <Suspense fallback={null}>
          <Workbench />
        </Suspense>
      ) : (
        <TvApp {...props} />
      )}
    </StrictMode>,
  );
}
