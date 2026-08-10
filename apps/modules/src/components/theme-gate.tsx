import { type ReactNode, useEffect, useState } from 'react';
import { readMode, THEME_EVENT, type ThemeMode, themeFor } from '#ui/core/theme-mode';
import { ThemeProvider } from '#ui/core/use-theme';

/**
 * Re-renders the tree when the palette changes.
 *
 * The kit resolves colours at render and writes them into styles, so
 * `setTheme()` alone changes nothing already on screen - `ThemeProvider` keys
 * the subtree on the theme version, which is what makes a swap visible.
 *
 * The mode is read in an effect, never during render: the server has no cookie
 * jar, and a value that differed between the two renders would be a hydration
 * mismatch.
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
