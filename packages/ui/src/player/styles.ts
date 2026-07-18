/**
 * Player keyframes. The chrome is styled with Tailwind (see ./tw.ts and each
 * client's `@source`); only the shared @keyframes the animations reference live
 * here, injected once per document.
 */

export const PLAYER_KEYFRAMES = `
@keyframes kpl-spin { to { transform: rotate(360deg); } }
@keyframes kpl-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes kpl-panel-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes kpl-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes kpl-pop-in { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: scale(1); } }
@keyframes kpl-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;

export const KEYFRAMES_STYLE_ID = 'kroma-player-keyframes';

/** Inject the shared player keyframes once per document (call from a useEffect). */
export function injectKeyframes(): void {
  if (typeof document === 'undefined' || document.getElementById(KEYFRAMES_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = KEYFRAMES_STYLE_ID;
  el.textContent = PLAYER_KEYFRAMES;
  document.head.appendChild(el);
}
