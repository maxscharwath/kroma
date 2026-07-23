/**
 * Player keyframes. The chrome is styled with Tailwind (see ./tw.ts and each
 * client's `@source`); only the shared @keyframes the animations reference live
 * here, injected once per document.
 */

import { webDocument } from '../lib/dom';

/** The browser surfaces (an in-page <video> for the web client, the AVPlay /
 * object placeholder on a TV) mount as a child of the player stage, and the
 * stage sizes them from here rather than from a style prop: the surface element
 * is supplied by the client, so the chrome cannot style it directly. A native
 * surface sizes itself and never sees this rule. */
const STAGE_SURFACE = `
#kroma-player-stage > video {
  width: 100%;
  height: 100%;
  background: #000;
  object-fit: contain;
  border-radius: inherit;
}
`;

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
  const doc = webDocument();
  if (!doc || doc.getElementById(KEYFRAMES_STYLE_ID)) return;
  const el = doc.createElement('style');
  el.id = KEYFRAMES_STYLE_ID;
  el.textContent = PLAYER_KEYFRAMES + STAGE_SURFACE;
  doc.head.appendChild(el);
}
