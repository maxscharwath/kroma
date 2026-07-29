import { IconBook, IconBrandGithub, IconBug, IconCircleCheck, IconMail } from '@tabler/icons-react';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Button } from '#site/components/button';
import { ContactCard } from '#site/components/contact/contact-card';
import { Faq, type FaqEntry } from '#site/components/contact/faq';
import { Container } from '#site/components/container';
import { seo } from '#site/lib/seo';
import { site } from '#site/lib/site';

export const Route = createFileRoute('/support')({
  head: () => ({
    ...seo({
      title: 'Support',
      description:
        'Où obtenir de l’aide pour KROMA : par e-mail, sur GitHub, dans le guide d’installation et la documentation. Plus comment bien signaler un bug.',
      path: '/support',
    }),
  }),
  component: Support,
});

// The checklist is lifted straight from CONTRIBUTING.md so a bug report arrives
// with what actually makes it reproducible, anything less and the first reply is
// always the same round of questions.
const bugChecklist: readonly { text: ReactNode }[] = [
  { text: 'Ce que vous attendiez, et ce qui s’est réellement passé.' },
  {
    text: 'La plateforme (web, Samsung Tizen, LG webOS, mobile, Apple TV / Android TV) et la version.',
  },
  {
    text: (
      <>
        Les journaux du serveur, lancé avec <code>RUST_LOG=debug</code>.
      </>
    ),
  },
  {
    text: (
      <>
        Pour un problème de lecture : le codec vidéo (<code>hevc</code>, <code>h264</code> ou{' '}
        <code>av1</code>) et l’audio (<code>ac3</code>, <code>eac3</code> ou <code>aac</code>) du
        titre.
      </>
    ),
  },
];

const faq: readonly FaqEntry[] = [
  {
    question: 'KROMA est-il gratuit ?',
    answer: (
      <>
        Oui. KROMA est un logiciel libre sous licence MIT : gratuit, sans abonnement et sans version
        « pro » payante. Le code est ouvert, vous pouvez l’auditer, le modifier et le redistribuer.
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
        Oui. Votre médiathèque et votre activité ne quittent jamais votre réseau. Les détails sont
        dans la <Link to="/privacy">politique de confidentialité</Link>.
      </>
    ),
  },
];

function Support() {
  return (
    <Container>
      <div className="py-16 sm:py-20">
        <header className="max-w-2xl">
          <p className="mb-3 font-sans text-xs font-bold uppercase tracking-[0.18em] text-accent">
            Support
          </p>
          <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.05] text-text sm:text-5xl">
            On est là pour vous aider.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted">
            KROMA est un projet libre et auto-hébergé. Selon votre besoin, une question, un bug,
            une installation à démarrer, voici la bonne porte à laquelle frapper.
          </p>
        </header>

        {/* The primary channel, given its own weight rather than a slot in the
            grid: for a small self-hosted project, a real inbox beats a ticket
            queue. */}
        <div className="surface-hairline mt-14 flex flex-col gap-6 rounded-2xl border border-border-strong bg-surface-1 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
          <div className="max-w-xl">
            <div className="flex size-12 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <IconMail size={24} stroke={1.75} />
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold text-text">Écrivez-nous</h2>
            <p className="mt-2 leading-relaxed text-muted">
              Pour toute question qui n’entre pas dans une issue publique, l’e-mail est le chemin le
              plus direct. On lit tout, et on répond en français comme en anglais.
            </p>
          </div>
          <div className="shrink-0">
            <Button href={`mailto:${site.email.support}`} size="lg">
              <IconMail size={18} stroke={1.75} />
              {site.email.support}
            </Button>
          </div>
        </div>

        {/* The other destinations, uniform because they are peers, each a
            distinct place, not a repeat of the same call to action. */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <ContactCard
            icon={IconBrandGithub}
            title="GitHub Issues"
            description="Signalez un bug ou proposez une fonctionnalité, au même endroit que le code."
            action="Ouvrir une issue"
            href={`${site.repo}/issues`}
          />
          <ContactCard
            icon={IconBook}
            title="Guide d’installation"
            description="Synology, Docker, Raspberry Pi, développeur TV : l’installation pas à pas."
            action="Lire le guide"
            href={`${site.repo}/blob/main/INSTALL.md`}
          />
          <ContactCard
            icon={IconBook}
            title="Documentation"
            description="Le dépôt, ses README par composant et les notes de contribution."
            action="Voir le dépôt"
            href={site.repo}
          />
        </div>

        {/* Bug-report checklist, a helping panel, not a wall of cards. */}
        <section className="mt-20">
          <div className="max-w-2xl">
            <div className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <IconBug size={22} stroke={1.75} />
            </div>
            <h2 className="mt-5 font-display text-2xl font-bold text-text sm:text-3xl">
              Bien signaler un bug
            </h2>
            <p className="mt-3 leading-relaxed text-muted">
              Un rapport reproductible est corrigé bien plus vite. Avant d’ouvrir une issue,
              rassemblez si possible :
            </p>
          </div>

          <ul className="mt-8 flex max-w-2xl flex-col gap-4">
            {bugChecklist.map((item, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable checklist
              <li key={i} className="flex items-start gap-3">
                <IconCircleCheck size={22} stroke={1.75} className="mt-0.5 shrink-0 text-accent" />
                <span className="leading-relaxed text-muted [&_code]:rounded-md [&_code]:border [&_code]:border-border [&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-accent">
                  {item.text}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8">
            <Button href={`${site.repo}/issues`} variant="outline">
              <IconBrandGithub size={18} stroke={1.75} />
              Ouvrir une issue sur GitHub
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-20">
          <h2 className="font-display text-2xl font-bold text-text sm:text-3xl">
            Questions fréquentes
          </h2>
          <div className="mt-8">
            <Faq items={faq} />
          </div>
        </section>
      </div>
    </Container>
  );
}
