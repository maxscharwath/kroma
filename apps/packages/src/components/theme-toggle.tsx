import { type CSSProperties, useEffect, useState } from 'react';
import { applyMode, readMode, type ThemeMode, writeMode } from '#ui/core/theme-mode';

const MODES: readonly { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

const GROUP: CSSProperties = {
  display: 'inline-flex',
  padding: 3,
  gap: 2,
  borderRadius: 'var(--radius-md)',
  background: 'var(--kroma-wash)',
  border: '1px solid var(--kroma-border)',
  margin: 0,
};

const OPTION = (on: boolean): CSSProperties => ({
  border: 0,
  cursor: 'pointer',
  padding: '5px 11px',
  borderRadius: 7,
  font: 'var(--type-meta)',
  fontWeight: 600,
  background: on ? 'var(--kroma-accent)' : 'transparent',
  color: on ? 'var(--kroma-accent-ink)' : 'var(--kroma-text-muted)',
});

/** Reads the stored mode in an effect, never during render: the server has no
 *  cookie jar, and a value that differs between the two is a hydration mismatch. */
export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    const stored = readMode();
    setMode(stored);
    applyMode(stored);
  }, []);

  useEffect(() => {
    if (mode !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyMode('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode]);

  return (
    <fieldset style={GROUP} aria-label="Thème">
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          aria-pressed={mode === m.value}
          style={OPTION(mode === m.value)}
          onClick={() => {
            setMode(m.value);
            writeMode(m.value);
          }}
        >
          {m.label}
        </button>
      ))}
    </fieldset>
  );
}
