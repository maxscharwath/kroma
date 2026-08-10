import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SegmentedControl } from '#ui/components/molecules/segmented-control';
import { applyMode, readMode, type ThemeMode, writeMode } from '#ui/core/theme-mode';
import { webWindow } from '#ui/lib/dom';
import type { ControlSize } from '#ui/lib/field-shell';

export interface ThemeSwitchProps {
  size?: ControlSize;
  style?: StyleProp<ViewStyle>;
}

const OPTIONS = [
  { value: 'system', label: 'Système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
] as const satisfies readonly { value: ThemeMode; label: string }[];

/**
 * Dark / light / system, persisted in a cookie so the server can render the
 * chosen palette instead of flashing the default one.
 *
 * Reads the stored mode in an effect rather than during render: the server has
 * no cookie jar, and a value that differs between the two renders is a
 * hydration mismatch.
 */
export function ThemeSwitch({ size = 'sm', style }: Readonly<ThemeSwitchProps>) {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    const stored = readMode();
    setMode(stored);
    applyMode(stored);
  }, []);

  useEffect(() => {
    if (mode !== 'system') return;
    const media = webWindow()?.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media?.addEventListener) return;
    const onChange = () => applyMode('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode]);

  return (
    <SegmentedControl
      label="Thème"
      size={size}
      value={mode}
      options={OPTIONS}
      onChange={(next) => {
        setMode(next);
        writeMode(next);
      }}
      style={style}
    />
  );
}
