import { useEffect, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SegmentedControl } from '#ui/components/molecules/segmented-control';
import { applyMode, readMode, type ThemeMode, writeMode } from '#ui/core/theme-mode';
import { webWindow } from '#ui/lib/dom';
import type { ControlSize } from '#ui/lib/field-shell';

export interface ThemeSwitchProps {
  size?: ControlSize;
  /** Accessible name of the group. Defaults to the product's French. */
  label?: string;
  /** Accessible names of the three modes, since the glyphs carry no words.
   *  Defaults to the product's French. */
  labels?: Readonly<Record<ThemeMode, string>>;
  style?: StyleProp<ViewStyle>;
}

const FR: Record<ThemeMode, string> = { system: 'Système', light: 'Clair', dark: 'Sombre' };

// Sun, moon, and the machine deciding: the three the whole web already reads
// without a word beside them.
const GLYPH = { system: 'device-desktop', light: 'sun', dark: 'moon' } as const;

const ORDER: readonly ThemeMode[] = ['system', 'light', 'dark'];

/**
 * Dark / light / system, persisted in a cookie so the server can render the
 * chosen ground instead of flashing the default one.
 *
 * Reads the stored mode in an effect rather than during render: the server has
 * no cookie jar, and a value that differs between the two renders is a
 * hydration mismatch.
 */
export function ThemeSwitch({
  size = 'sm',
  label = 'Thème',
  labels = FR,
  style,
}: Readonly<ThemeSwitchProps>) {
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
    <SegmentedControl.Root
      label={label}
      size={size}
      iconOnly
      value={mode}
      onValueChange={(next) => {
        setMode(next);
        writeMode(next);
      }}
      style={style}
    >
      {ORDER.map((value) => (
        <SegmentedControl.Item
          key={value}
          value={value}
          label={labels[value]}
          icon={GLYPH[value]}
        />
      ))}
    </SegmentedControl.Root>
  );
}
