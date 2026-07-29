// One place for the facts the whole site repeats: the domain, the contact
// addresses, the nav, the one-line pitch. Everything user-facing here is French,
// matching the app's copy and the design language (no emoji).

export const site = {
  name: 'KROMA',
  domain: 'kroma.tv',
  url: 'https://kroma.tv',
  /** The app's own tagline, kept in step with the README. */
  tagline: 'Votre propre Netflix, sur du matériel que vous possédez.',
  taglineEn: 'Your own Netflix, on hardware you own.',
  description:
    "KROMA réunit l'indexeur, le moteur de téléchargement, le VPN, le serveur et le lecteur sous un seul serveur auto-hébergé. Direct-play, HEVC natif, sur le web, le mobile et toutes les télévisions.",
  descriptionEn:
    'KROMA brings the indexer, the download engine, the VPN, the server and the player together under one self-hosted server. Direct-play, native HEVC, on the web, on mobile and on every television.',
  repo: 'https://github.com/maxscharwath/kroma',
  /** The 10-foot experience, served on its own subdomain (clients/tv-web). */
  tvUrl: 'https://tv.kroma.tv',
  /** The design system / component kit, on its own subdomain. */
  uiUrl: 'https://ui.kroma.tv',
  /** The backend module registry / catalogue. */
  modulesUrl: 'https://modules.kroma.tv',
  /** The Synology package source: downloads + automatic server updates. */
  packagesUrl: 'https://packages.kroma.tv',
  email: {
    support: 'support@kroma.tv',
    privacy: 'privacy@kroma.tv',
  },
} as const;

export interface NavLink {
  readonly label: string;
  readonly to: string;
}

/** The primary navigation, in the header and mirrored in the footer. */
export const navLinks: readonly NavLink[] = [
  { label: 'Fonctionnalités', to: '/#fonctionnalites' },
  { label: 'Plateformes', to: '/#plateformes' },
  { label: 'Installer', to: '/download' },
  { label: 'Blog', to: '/blog' },
] as const;
