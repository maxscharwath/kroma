import { useCallback, useSyncExternalStore } from 'react';
import { engine } from './engine';

const NONE: readonly string[] = [];

/** Every locale the engine offers, kept current for one that settles its
 *  answer after the tools mount. */
export function useLocales(): readonly string[] {
  const subscribe = useCallback(
    (listener: () => void) => engine().subscribe?.(listener) ?? noop,
    [],
  );
  return useSyncExternalStore(subscribe, locales, empty);
}

function locales(): readonly string[] {
  return engine().locales();
}

function empty(): readonly string[] {
  return NONE;
}

function noop(): void {}
