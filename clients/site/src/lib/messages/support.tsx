import { L } from '#site/components/localized-link';
import { useLang } from '#site/lib/i18n';
import { site } from '#site/lib/site';

// The support page in every locale. Two blocks are rich text rather than plain
// strings: the bug checklist, whose <code> chips name the exact flags and codecs
// a useful report carries (it is lifted from CONTRIBUTING.md), and the FAQ
// answers, which link out to the install guide and across to the privacy page.

export const support = {
  fr: {
    head: {
      title: 'Support',
      description:
        'Où obtenir de l’aide pour KROMA : par e-mail, sur GitHub, dans le guide d’installation et la documentation. Plus comment bien signaler un bug.',
    },
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
    faq: {
      title: 'Questions fréquentes',
      items: [
        {
          question: 'KROMA est-il gratuit ?',
          answer: (
            <>
              Oui. KROMA est un logiciel libre sous licence GPL-2.0 : gratuit, sans abonnement et
              sans version « pro » payante. Le code est ouvert, vous pouvez l’auditer, le modifier
              et le redistribuer.
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
              <a
                href={`${site.repo}/blob/main/INSTALL.md`}
                target="_blank"
                rel="noreferrer noopener"
              >
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
  },
  en: {
    head: {
      title: 'Support',
      description:
        'Where to get help with KROMA: by email, on GitHub, in the install guide and the docs. Plus how to report a bug well.',
    },
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
    faq: {
      title: 'Frequently asked questions',
      items: [
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
              A NAS, a Docker host or a Raspberry Pi (64-bit system) is enough: KROMA is a single
              Rust binary, or a multi-architecture Docker image. The{' '}
              <a
                href={`${site.repo}/blob/main/INSTALL.md`}
                target="_blank"
                rel="noreferrer noopener"
              >
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
  },
} as const;

/** The support page's copy for the active locale. */
export function useSupport() {
  return support[useLang()];
}
