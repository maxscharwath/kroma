import { useLang } from '#site/lib/i18n';

// The chrome dictionary: everything the header, footer, 404 and language switcher
// say. Each PAGE has its own catalog beside this one (`home`, `download`,
// `privacy`, `support`, `blog`); this file holds only what the shell says on every
// one of them.
//
// No component anywhere carries a string. That is the rule the whole folder
// exists to enforce: at thirty languages a component that colocated its copy
// would be unreadable, while these stay flat and a page stays layout. Authored
// `as const` so every locale is checked against the same shape - a key a new
// language has not translated yet is a compile error, not a blank space in
// production.

export const common = {
  fr: {
    nav: {
      features: 'Fonctionnalités',
      platforms: 'Plateformes',
      install: 'Installer',
      blog: 'Blog',
    },
    header: {
      home: 'KROMA, accueil',
      github: 'KROMA sur GitHub',
      menu: 'Menu',
      install: 'Installer',
    },
    footer: {
      blurb:
        'Votre médiathèque, chez vous. Auto-hébergée, privée, sans abonnement : un seul binaire Rust, sur tous vos écrans.',
      star: 'Star sur GitHub',
      cols: { product: 'Produit', resources: 'Ressources', contact: 'Contact', legal: 'Légal' },
      links: {
        features: 'Fonctionnalités',
        platforms: 'Plateformes',
        install: 'Installer',
        tvDemo: 'Démo TV',
        uiKit: 'UI Kit',
        modules: 'Modules',
        blog: 'Blog',
        source: 'Code source',
        installGuide: 'Guide d’installation',
        contribute: 'Contribuer',
        privacy: 'Confidentialité',
        support: 'Support',
        license: 'Licence GPL-2.0',
      },
      rights: '© 2026 KROMA. Logiciel libre sous licence GPL-2.0.',
      tagline: 'Conçu pour être possédé, pas loué.',
    },
    lang: { label: 'Langue', switchTo: 'Passer en anglais' },
    notFound: {
      code: '404',
      body: 'Cette page a quitté la grille. Le catalogue, lui, est toujours là.',
      home: 'Retour à l’accueil',
    },
  },
  en: {
    nav: {
      features: 'Features',
      platforms: 'Platforms',
      install: 'Install',
      blog: 'Blog',
    },
    header: {
      home: 'KROMA, home',
      github: 'KROMA on GitHub',
      menu: 'Menu',
      install: 'Install',
    },
    footer: {
      blurb:
        'Your library, at home. Self-hosted, private, no subscription: a single Rust binary, on every screen you own.',
      star: 'Star on GitHub',
      cols: { product: 'Product', resources: 'Resources', contact: 'Contact', legal: 'Legal' },
      links: {
        features: 'Features',
        platforms: 'Platforms',
        install: 'Install',
        tvDemo: 'TV demo',
        uiKit: 'UI Kit',
        modules: 'Modules',
        blog: 'Blog',
        source: 'Source code',
        installGuide: 'Install guide',
        contribute: 'Contributing',
        privacy: 'Privacy',
        support: 'Support',
        license: 'GPL-2.0 license',
      },
      rights: '© 2026 KROMA. Free software under the GPL-2.0 license.',
      tagline: 'Built to be owned, not rented.',
    },
    lang: { label: 'Language', switchTo: 'Switch to French' },
    notFound: {
      code: '404',
      body: 'This page left the grid. The catalogue is still right where you left it.',
      home: 'Back to home',
    },
  },
} as const;

/** The chrome strings for the active locale. */
export function useCommon() {
  return common[useLang()];
}
