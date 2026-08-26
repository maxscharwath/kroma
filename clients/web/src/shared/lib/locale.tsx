import type { Locale } from '@kroma/core';
import { LocaleProvider as UiLocaleProvider, useLocale } from '@kroma/ui';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '#web/shared/lib/auth';

// Everything the server sends is already in a language: a title, an overview,
// a poster with the name printed on it. The client asks for one through
// Accept-Language, so a cached answer is an answer in the language that was
// current when it was fetched, and switching afterwards leaves the whole app
// reading the old one until something else happens to refetch.
function RefetchOnLocaleChange({ children }: Readonly<{ children: ReactNode }>) {
  const locale = useLocale();
  const queryClient = useQueryClient();
  const served = useRef<string | null>(null);
  useEffect(() => {
    const before = served.current;
    served.current = locale;
    // Nothing has been fetched in the wrong language on the first pass, and
    // invalidating there would throw away the work the first paint just did.
    if (before === null || before === locale) return;
    void queryClient.invalidateQueries();
  }, [locale, queryClient]);
  return children;
}

export function LocaleProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { user, client, updateUser } = useAuth();
  return (
    <UiLocaleProvider
      client={client}
      accountLanguage={user?.language}
      onAccountChange={user ? (next: Locale) => updateUser({ language: next }) : undefined}
      syncHtmlLang
    >
      <RefetchOnLocaleChange>{children}</RefetchOnLocaleChange>
    </UiLocaleProvider>
  );
}
