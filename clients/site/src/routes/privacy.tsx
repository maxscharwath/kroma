import { IconShieldLock } from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';
import { ContactCard } from '#site/components/contact/contact-card';
import { PageShell } from '#site/components/contact/page-shell';
import { privacy, usePrivacy } from '#site/lib/messages/privacy';
import { seo } from '#site/lib/seo';
import { site } from '#site/lib/site';

export const Route = createFileRoute('/privacy')({
  // `head` runs outside React, so it reads the English catalog directly rather
  // than through the locale hook.
  head: () => ({ ...seo({ lang: 'en', ...privacy.en.head, path: '/privacy' }) }),
  component: Privacy,
});

export function Privacy() {
  const t = usePrivacy();
  return (
    <PageShell size="prose" eyebrow={t.eyebrow} title={t.title} updated={t.updated} intro={t.intro}>
      <div className="mt-12 h-px bg-border" />

      <div className="prose-kroma mt-12">{t.prose}</div>

      {/* A real contact affordance to close on, rather than a bare mailto in a
          paragraph, the same channel, made unmissable. */}
      <div className="mt-14">
        <ContactCard
          icon={IconShieldLock}
          title={t.card.title}
          description={t.card.description}
          action={site.email.privacy}
          href={`mailto:${site.email.privacy}`}
        />
      </div>
    </PageShell>
  );
}
