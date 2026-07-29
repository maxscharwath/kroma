import { IconBook, IconBrandGithub, IconBug, IconCircleCheck, IconMail } from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';
import { Button } from '#site/components/button';
import { ContactCard } from '#site/components/contact/contact-card';
import { Faq } from '#site/components/contact/faq';
import { PageShell } from '#site/components/contact/page-shell';
import { getLocale } from '#site/lib/i18n';
import { support, useSupport } from '#site/lib/messages/support';
import { seo } from '#site/lib/seo';
import { site } from '#site/lib/site';

export const Route = createFileRoute('/support')({
  // `head` runs outside React, so it reads the English catalog directly rather
  // than through the locale hook.
  head: () => {
    const lang = getLocale();
    return seo({ lang, ...support[lang].head, path: '/support' });
  },
  component: Support,
});

/** The glyph and destination of each secondary channel; its wording lives in the
 *  catalog under the same key. */
const channels = [
  { key: 'issues', icon: IconBrandGithub, href: `${site.repo}/issues` },
  { key: 'install', icon: IconBook, href: `${site.repo}/blob/main/INSTALL.md` },
  { key: 'docs', icon: IconBook, href: site.repo },
] as const;

export function Support() {
  const t = useSupport();
  return (
    <PageShell eyebrow={t.eyebrow} title={t.title} intro={t.intro}>
      {/* The primary channel, given its own weight rather than a slot in the
          grid: for a small self-hosted project, a real inbox beats a ticket
          queue. */}
      <div className="surface-hairline mt-14 flex flex-col gap-6 rounded-2xl border border-border-strong bg-surface-1 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div className="max-w-xl">
          <div className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <IconMail size={24} stroke={1.75} aria-hidden />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold text-text">{t.email.title}</h2>
          <p className="mt-2 leading-relaxed text-muted">{t.email.body}</p>
        </div>
        <div className="shrink-0">
          <Button href={`mailto:${site.email.support}`} size="lg">
            <IconMail size={18} stroke={1.75} aria-hidden />
            {site.email.support}
          </Button>
        </div>
      </div>

      {/* The other destinations, uniform because they are peers, each a
          distinct place, not a repeat of the same call to action. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {channels.map(({ key, icon, href }) => (
          <ContactCard key={key} icon={icon} href={href} {...t.channels[key]} />
        ))}
      </div>

      {/* Bug-report checklist, a helping panel, not a wall of cards. */}
      <section className="mt-20">
        <div className="max-w-2xl">
          <div className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <IconBug size={22} stroke={1.75} aria-hidden />
          </div>
          <h2 className="mt-5 font-display text-2xl font-bold text-text sm:text-3xl">
            {t.bug.title}
          </h2>
          <p className="mt-3 leading-relaxed text-muted">{t.bug.intro}</p>
        </div>

        <ul className="mt-8 flex max-w-2xl flex-col gap-4">
          {t.bug.checklist.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable checklist
            <li key={i} className="flex items-start gap-3">
              <IconCircleCheck
                size={22}
                stroke={1.75}
                className="mt-0.5 shrink-0 text-accent"
                aria-hidden
              />
              <span className="leading-relaxed text-muted [&_code]:rounded-md [&_code]:border [&_code]:border-border [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-accent">
                {item}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <Button href={`${site.repo}/issues`} variant="outline">
            <IconBrandGithub size={18} stroke={1.75} aria-hidden />
            {t.bug.button}
          </Button>
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-2xl font-bold text-text sm:text-3xl">{t.faq.title}</h2>
        <div className="mt-8">
          <Faq items={t.faq.items} />
        </div>
      </section>
    </PageShell>
  );
}
