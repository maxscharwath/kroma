import { activeLocale } from '@kroma/core';
import { installKeyInspector, installLocaleOverride } from '@kroma/i18n';
import { keyLabel } from '@kroma/i18n/devtools';
import { Button } from '@kroma/ui/kit';
import { useEffect, useState } from 'react';
import { Panel } from './panel';
import { type DevtoolsSession, readSession, writeSession } from './session';

export function Devtools() {
  const [session, setSession] = useState<DevtoolsSession>(readSession);
  const patch = (fields: Partial<DevtoolsSession>) =>
    setSession((current) => ({ ...current, ...fields }));

  useEffect(() => {
    writeSession(session);
  }, [session]);

  useEffect(() => {
    installKeyInspector(session.keys ? keyLabel : null);
  }, [session.keys]);

  useEffect(() => {
    installLocaleOverride(session.locale);
  }, [session.locale]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSession((s) => (s.open ? { ...s, open: false } : s));
      if (!(event.ctrlKey && event.altKey)) return;
      if (event.code === 'KeyK') setSession((s) => ({ ...s, keys: !s.keys }));
      if (event.code === 'KeyI') setSession((s) => ({ ...s, open: !s.open }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!session.open) {
    return (
      <Button
        size="sm"
        variant="glass"
        icon="language"
        label="i18n"
        onPress={() => patch({ open: true })}
      />
    );
  }
  return (
    <Panel
      locale={session.locale}
      appLocale={activeLocale()}
      keys={session.keys}
      onLocale={(locale) => patch({ locale })}
      onKeys={(keys) => patch({ keys })}
      onClose={() => patch({ open: false })}
    />
  );
}
