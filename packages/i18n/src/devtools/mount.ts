import { activeKeyInspector, installKeyInspector } from '../inspect';
import { keyLabel } from './key-label';

const CHORD = 'ctrl+alt+K';

function matchesChord(event: KeyboardEvent): boolean {
  return event.ctrlKey && event.altKey && event.code === 'KeyK';
}

/** Bind this page's i18n dev tools: {@link CHORD} swaps every rendered message
 *  for `[source/key]` and back. Returns a disposer, and does nothing where there
 *  is no window. */
export function mount(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onKeyDown = (event: KeyboardEvent) => {
    if (!matchesChord(event)) return;
    event.preventDefault();
    installKeyInspector(activeKeyInspector() ? null : keyLabel);
  };
  window.addEventListener('keydown', onKeyDown);
  console.info(`[kroma-i18n] ${CHORD} shows each message key and the catalog that answered it`);
  return () => {
    window.removeEventListener('keydown', onKeyDown);
  };
}
