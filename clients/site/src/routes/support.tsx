import { IconBook, IconBrandGithub, IconBug, IconCircleCheck, IconMail } from '@tabler/icons-react';
import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Button } from '#site/components/button';
import { ContactCard } from '#site/components/contact/contact-card';
import { Faq, type FaqEntry } from '#site/components/contact/faq';
import { Container } from '#site/components/container';
import { L } from '#site/components/localized-link';
import { type Lang, useLang } from '#site/lib/i18n';
import { seo } from '#site/lib/seo';
import { site } from '#site/lib/site';

export const Route = createFileRoute('/support')({
  head: () => ({
    ...seo({
      lang: 'en',
      title: 'Support',
      description:
        'Where to get help with KROMA: by email, on GitHub, in the install guide and the docs. Plus how to report a bug well.',
      path: '/support',
    }),
  }),
  component: Support,
});

/** A single support channel's user-facing copy (the ContactCard text). */
interface ChannelCopy {
  title: string;
  description: string;
  action: string;
}

/** All of the page's translatable strings, one shape per locale so `copy[lang]`
 *  resolves to a single type (not a union), which keeps the mapped checklist and
 *  the FAQ array strictly typed. */
interface SupportCopy {
  eyebrow: string;
  title: string;
  intro: string;
  email: { title: string; body: string };
  channels: { issues: ChannelCopy; install: ChannelCopy; docs: ChannelCopy };
  bug: {
    title: string;
    intro: string;
    button: string;
    // The checklist is lifted straight from CONTRIBUTING.md so a bug report
    // arrives with what actually makes it reproducible; the <code> chips are why
    // each item is rich text rather than a plain string.
    checklist: readonly ReactNode[];
  };
  faqTitle: string;
  faq: readonly FaqEntry[];
}

const copy: Record<Lang, SupportCopy> = {
  fr: {
    eyebrow: 'Support',
    title: 'On est là pour vous aider.',
    intro:
      'KROMA est un projet libre et auto-hébergé. Selon votre besoin, une question, un bug, une installation à démarrer, voici la bonne porte à laquelle frapper.',
    email: {
      title: 'Écrivez-nous',
      body: 'Pour toute question qui n’entre pas dans une issue publique, l’e-mail est le chemin le plus direct. On lit tout, et on répond en français comme en anglais.',
    },
    channels: {
      issues: {
        title: 'GitHub Issues',
        description: 'Signalez un bug ou proposez une fonctionnalité, au même endroit que le code.',
        action: 'Ouvrir une issue',
      },
      install: {
        title: 'Guide d’installation',
        description: 'Synology, Docker, Raspberry Pi, développeur TV : l’installation pas à pas.',
        action: 'Lire le guide',
      },
      docs: {
        title: 'Documentation',
        description: 'Le dépôt, ses README par composant et les notes de contribution.',
        action: 'Voir le dépôt',
      },
    },
    bug: {
      title: 'Bien signaler un bug',
      intro:
        'Un rapport reproductible est corrigé bien plus vite. Avant d’ouvrir une issue, rassemblez si possible :',
      button: 'Ouvrir une issue sur GitHub',
      checklist: [
        'Ce que vous attendiez, et ce qui s’est réellement passé.',
        'La plateforme (web, Samsung Tizen, LG webOS, mobile, Apple TV / Android TV) et la version.',
        <>
          Les journaux du serveur, lancé avec <code>RUST_LOG=debug</code>.
        </>,
        <>
          Pour un problème de lecture : le codec vidéo (<code>hevc</code>, <code>h264</code> ou{' '}
          <code>av1</code>) et l’audio (<code>ac3</code>, <code>eac3</code> ou <code>aac</code>) du
          titre.
        </>,
      ],
    },
    faqTitle: 'Questions fréquentes',
    faq: [
      {
        question: 'KROMA est-il gratuit ?',
        answer: (
          <>
            Oui. KROMA est un logiciel libre sous licence GPL-2.0 : gratuit, sans abonnement et sans
            version « pro » payante. Le code est ouvert, vous pouvez l’auditer, le modifier et le
            redistribuer.
          </>
        ),
      },
      {
        question: 'Quelles plateformes sont prises en charge ?',
        answer:
          'Le web (navigateur de bureau), le mobile iPhone / iPad / Android, les téléviseurs Samsung (Tizen) et LG (webOS), ainsi que l’Apple TV et l’Android TV.',
      },
      {
        question: 'De quoi ai-je besoin pour l’auto-héberger ?',
        answer: (
          <>
            Un NAS, un hôte Docker ou un Raspberry Pi (système 64 bits) suffit : KROMA est un seul
            binaire Rust, ou une image Docker multi-architecture. Le{' '}
            <a href={`${site.repo}/blob/main/INSTALL.md`} target="_blank" rel="noreferrer noopener">
              guide d’installation
            </a>{' '}
            détaille Synology, Docker et les autres cas.
          </>
        ),
      },
      {
        question: 'Mes données restent-elles chez moi ?',
        answer: (
          <>
            Oui. Votre médiathèque et votre activité ne quittent jamais votre réseau. Les détails
            sont dans la <L to="/privacy">politique de confidentialité</L>.
          </>
        ),
      },
    ],
  },
  en: {
    eyebrow: 'Support',
    title: 'We are here to help.',
    intro:
      'KROMA is a free, self-hosted project. Depending on what you need, a question, a bug, an install to get going, here is the right door to knock on.',
    email: {
      title: 'Write to us',
      body: 'For anything that does not belong in a public issue, email is the most direct route. We read everything, and we reply in English as well as in French.',
    },
    channels: {
      issues: {
        title: 'GitHub Issues',
        description: 'Report a bug or suggest a feature, in the same place as the code.',
        action: 'Open an issue',
      },
      install: {
        title: 'Installation guide',
        description: 'Synology, Docker, Raspberry Pi, TV developer mode: the step-by-step install.',
        action: 'Read the guide',
      },
      docs: {
        title: 'Documentation',
        description: 'The repository, its per-component READMEs and the contributing notes.',
        action: 'View the repository',
      },
    },
    bug: {
      title: 'Reporting a bug well',
      intro:
        'A reproducible report is fixed far faster. Before opening an issue, gather the following if you can:',
      button: 'Open an issue on GitHub',
      checklist: [
        'What you expected, and what actually happened.',
        'The platform (web, Samsung Tizen, LG webOS, mobile, Apple TV / Android TV) and the version.',
        <>
          The server logs, started with <code>RUST_LOG=debug</code>.
        </>,
        <>
          For a playback problem: the title's video codec (<code>hevc</code>, <code>h264</code> or{' '}
          <code>av1</code>) and audio (<code>ac3</code>, <code>eac3</code> or <code>aac</code>).
        </>,
      ],
    },
    faqTitle: 'Frequently asked questions',
    faq: [
      {
        question: 'Is KROMA free?',
        answer: (
          <>
            Yes. KROMA is free software under the GPL-2.0 license: free of charge, no subscription
            and no paid "pro" edition. The code is open, so you can audit it, modify it and
            redistribute it.
          </>
        ),
      },
      {
        question: 'Which platforms are supported?',
        answer:
          'The web (desktop browser), mobile on iPhone / iPad / Android, Samsung (Tizen) and LG (webOS) televisions, as well as Apple TV and Android TV.',
      },
      {
        question: 'What do I need to self-host it?',
        answer: (
          <>
            A NAS, a Docker host or a Raspberry Pi (64-bit system) is enough: KROMA is a single Rust
            binary, or a multi-architecture Docker image. The{' '}
            <a href={`${site.repo}/blob/main/INSTALL.md`} target="_blank" rel="noreferrer noopener">
              installation guide
            </a>{' '}
            covers Synology, Docker and the other cases.
          </>
        ),
      },
      {
        question: 'Does my data stay with me?',
        answer: (
          <>
            Yes. Your library and your activity never leave your network. The details are in the{' '}
            <L to="/privacy">privacy policy</L>.
          </>
        ),
      },
    ],
  },
};

export function Support() {
  const t = copy[useLang()];
  return (
    <Container>
      <div className="py-16 sm:py-20">
        <header className="max-w-2xl">
          <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
            {t.eyebrow}
          </p>
          <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.05] text-text sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">{t.intro}</p>
        </header>

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
          <ContactCard
            icon={IconBrandGithub}
            title={t.channels.issues.title}
            description={t.channels.issues.description}
            action={t.channels.issues.action}
            href={`${site.repo}/issues`}
          />
          <ContactCard
            icon={IconBook}
            title={t.channels.install.title}
            description={t.channels.install.description}
            action={t.channels.install.action}
            href={`${site.repo}/blob/main/INSTALL.md`}
          />
          <ContactCard
            icon={IconBook}
            title={t.channels.docs.title}
            description={t.channels.docs.description}
            action={t.channels.docs.action}
            href={site.repo}
          />
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

        {/* FAQ */}
        <section className="mt-20">
          <h2 className="font-display text-2xl font-bold text-text sm:text-3xl">{t.faqTitle}</h2>
          <div className="mt-8">
            <Faq items={t.faq} />
          </div>
        </section>
      </div>
    </Container>
  );
}
