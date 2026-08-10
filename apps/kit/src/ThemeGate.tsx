import { readMode, THEME_EVENT, type ThemeMode, ThemeProvider, themeFor } from '@kroma/ui/kit';
import { type ReactNode, useEffect, useState } from 'react';

/**
 * Re-renders the workbench when the palette changes.
 *
 * The kit resolves colours at render and writes them into styles, so
 * `setTheme()` alone leaves everything already on screen painted in the old
 * palette - and the next thing to re-render for its own reasons (a hover, a
 * press) repaints in the new one, which is why a half-switched page follows the
 * pointer around. `ThemeProvider` keys the subtree on the theme version, so the
 * whole tree moves at once.
 */
export function ThemeGate({ children }: Readonly<{ children: ReactNode }>) {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    setMode(readMode());
    const onChange = (e: Event) => setMode((e as CustomEvent<ThemeMode>).detail);
    window.addEventListener(THEME_EVENT, onChange);
    return () => window.removeEventListener(THEME_EVENT, onChange);
  }, []);

  return <ThemeProvider theme={themeFor(mode)}>{children}</ThemeProvider>;
}
