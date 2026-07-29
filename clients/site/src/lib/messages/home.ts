import { useLang } from '#site/lib/i18n';
import { site } from '#site/lib/site';

// Every string the home page says, in both languages, one section per band. The
// components hold structure only (icons, spans, ordering, language-invariant
// technical names); adding a language means adding an entry here and touching no
// component.
//
// Headings mark their amber span inline with brackets, `Six conteneurs. [Un seul
// serveur.]`, so each language places the accent inside its own whole sentence
// instead of the component reassembling three fragments (see <AccentHeading>).
//
// The architecture claim is deliberate: KROMA is "un seul serveur" / "one server",
// not one OS process, because the indexer, downloader and VPN run as
// out-of-process modules. The licence is GPL-2.0 throughout.

export const home = {
  fr: {
    hero: {
      pill: 'un seul binaire Rust · open source · GPL-2.0',
      logoAlt: 'KROMA',
      heading: 'Votre médiathèque, [chez vous].',
      // The SEO meta reads the same source, so the lead and the description can
      // never drift apart.
      description: site.description,
      install: 'Installer KROMA',
      code: 'Voir le code',
      facts: ['démarre en millisecondes', 'zéro conteneur', 'la vidéo n’est jamais ré-encodée'],
    },
    oneBinary: {
      eyebrow: 'Un seul serveur',
      heading: 'Six conteneurs. [Un seul serveur.]',
      lead: 'Une installation classique boulonne ensemble une demi-douzaine de services, six configs, six choses qui cassent, jamais au même moment. KROMA les remplace par un seul serveur Rust qui démarre en millisecondes et ne garde aucune ferme de transcodage au chaud.',
      beforeLabel: 'Avant · six conteneurs',
      badge: '1 serveur',
      replaces: {
        acquisition: 'acquisition',
        indexers: 'indexeurs',
        downloader: 'téléchargement',
        vpn: 'VPN + kill-switch',
        server: 'serveur + lecteur',
        requests: 'requêtes',
      },
      native: [
        'Indexeurs Cardigann + Torznab',
        'Moteur BitTorrent librqbit',
        'Décision de qualité, import et renommage',
        'Pont WireGuard → SOCKS5 avec kill-switch',
        'Lecteur direct-play, HEVC natif',
      ],
    },
    features: {
      eyebrow: 'Tout est inclus',
      title: 'Toute la chaîne, dans un seul serveur',
      intro:
        'Trouvez, téléchargez, organisez, diffusez. Chaque maillon d’une médiathèque auto-hébergée, écrit une fois et partagé, sans rien à câbler entre eux.',
      items: {
        acquisition: {
          title: 'Acquisition automatique',
          body: 'Demandez un titre : KROMA cherche chez tous vos indexeurs, note chaque release sur la résolution, le codec, la taille, les seeders et vos mots-clés, récupère la meilleure, puis l’importe et la renomme façon Plex.',
          tag: 'moteur de décision · wanted-list',
        },
        vpn: {
          title: 'VPN avec vrai kill-switch',
          body: 'Collez une config WireGuard et tout le trafic torrent passe par un pont WireGuard→SOCKS5 managé. Un test de tunnel qui échoue met chaque téléchargement en pause à l’instant : pas de fuite, pas de Gluetun à câbler.',
          tag: 'WireGuard → SOCKS5',
        },
        indexers: {
          title: 'Indexeurs natifs',
          body: 'Un moteur Cardigann réimplémenté exécute les définitions de trackers de Jackett et Prowlarr, directement.',
          tag: 'Cardigann + Torznab',
        },
        downloader: {
          title: 'Moteur de téléchargement',
          body: 'Un client BitTorrent librqbit récupère les releases directement, piloté par KROMA. Transmission et qBittorrent restent supportés.',
          tag: 'librqbit',
        },
        player: {
          title: 'Lecteur direct-play',
          body: 'Les fichiers originaux sont diffusés par plages d’octets et décodés par le client. La vidéo n’est jamais ré-encodée.',
          tag: 'HEVC/H.265 · range-streamed',
        },
        ai: {
          title: 'IA embarquée',
          body: 'Recommandations et recherche sémantique sur des embeddings locaux, sous-titres générés par Whisper. Sur votre machine, sans cloud.',
          tag: 'on-device · Whisper',
        },
        users: {
          title: 'Multi-utilisateur',
          body: 'Comptes, profils, verrous PIN, passkeys WebAuthn, invitations et permissions par utilisateur. Partagez sans tout ouvrir.',
          tag: 'profils · PIN · passkeys',
        },
        stats: {
          title: 'Statistiques en direct',
          body: 'Téléchargements, scans de bibliothèque et lectures poussés en temps réel sur un bus WebSocket, vers les tableaux de bord et les clients.',
          tag: 'bus WebSocket',
        },
      },
    },
    directPlay: {
      eyebrow: 'Direct-play, HEVC d’abord',
      heading: 'Le serveur ne [transcode jamais] la vidéo.',
      lead: 'KROMA diffuse les fichiers originaux par plages d’octets ; chaque client décode le HEVC/H.265 lui-même, en 10-bit et en HDR, en matériel sur les téléviseurs Samsung et LG. Pas de pipeline de transcodage, pas de ferme de CPU à garder au chaud.',
      exception:
        'Seule exception : un flux audio-only HLS pour les navigateurs qui ne décodent pas AC3/EAC3/DTS. La vidéo est copiée, seul l’audio passe en AAC stéréo.',
      decodedBy: 'Décodé par le client',
      cpuLabel: 'CPU du NAS pendant la lecture',
      cpuState: 'au repos',
      cpuNote:
        'Rien à ré-encoder : la lecture ne réveille pas le processeur. Votre NAS reste disponible pour tout le reste.',
    },
    platforms: {
      eyebrow: 'Plateformes',
      title: 'Le même KROMA, sur chaque écran',
      intro:
        'Les composants et les jetons de design existent une seule fois, dans un kit partagé, et se rendent nativement, du navigateur au salon piloté à la télécommande.',
      install: 'Installer',
      tvDemo: 'Démo TV',
      groups: { screens: 'Écrans', televisions: 'Télévisions', server: 'Serveur' },
      items: {
        web: { name: 'Web', detail: 'navigateur · responsive' },
        mobile: { name: 'Mobile', detail: 'iPhone · iPad · Android' },
        desktop: { name: 'Bureau', detail: 'macOS · Windows · Linux · Steam Deck' },
        samsung: { name: 'Samsung', detail: 'Tizen' },
        lg: { name: 'LG', detail: 'webOS' },
        androidTv: { name: 'Android TV', detail: 'Google TV' },
        appleTv: { name: 'Apple TV', detail: 'tvOS' },
        cast: { name: 'Cast', detail: 'téléphone → téléviseur' },
        synology: { name: 'Synology', detail: 'paquet .spk' },
        docker: { name: 'Docker', detail: 'image multi-arch' },
        raspberryPi: { name: 'Raspberry Pi', detail: 'arm64 64-bit' },
      },
    },
    selfHost: {
      eyebrow: 'Auto-hébergé',
      heading: 'Conçu pour être [possédé], pas loué.',
      lead: 'Open source, sous licence GPL-2.0. Pas de compte à créer, pas d’abonnement, pas de service central qui pourrait fermer. Votre bibliothèque et votre activité ne quittent jamais votre réseau.',
      github: 'Voir sur GitHub',
      terminal: 'démarrer KROMA',
      points: {
        free: { title: 'Libre', sub: 'Code ouvert, licence GPL-2.0' },
        private: { title: 'Privé', sub: 'Rien ne quitte votre réseau' },
        noCentral: { title: 'Sans central', sub: 'Aucun compte, aucun abonnement' },
        offline: { title: 'Hors-ligne', sub: 'La lecture fonctionne sans internet' },
      },
    },
    blogTeaser: {
      eyebrow: 'Journal',
      heading: 'Depuis le blog',
      all: 'Tous les articles',
    },
    finalCta: {
      heading: 'Reprenez la main sur votre [médiathèque].',
      lead: 'Un binaire à lancer, votre matériel, vos fichiers. Aucun abonnement, aucune donnée qui s’échappe.',
      install: 'Installer KROMA',
      code: 'Voir le code',
      legal: '© 2026 · logiciel libre · licence GPL-2.0',
    },
  },
  en: {
    hero: {
      pill: 'a single Rust binary · open source · GPL-2.0',
      logoAlt: 'KROMA',
      heading: 'Your media library, [at home].',
      description: site.descriptionEn,
      install: 'Install KROMA',
      code: 'View the code',
      facts: ['starts in milliseconds', 'zero containers', 'video is never re-encoded'],
    },
    oneBinary: {
      eyebrow: 'A single server',
      heading: 'Six containers. [One server.]',
      lead: 'A typical setup bolts together half a dozen services: six configs, six things that break, never at the same time. KROMA replaces them with a single Rust server that starts in milliseconds and keeps no transcoding farm warm.',
      beforeLabel: 'Before · six containers',
      badge: '1 server',
      replaces: {
        acquisition: 'acquisition',
        indexers: 'indexers',
        downloader: 'downloading',
        vpn: 'VPN + kill-switch',
        server: 'server + player',
        requests: 'requests',
      },
      native: [
        'Cardigann + Torznab indexers',
        'librqbit BitTorrent engine',
        'Quality decisions, import and renaming',
        'WireGuard → SOCKS5 bridge with kill-switch',
        'Direct-play player, native HEVC',
      ],
    },
    features: {
      eyebrow: 'Everything included',
      title: 'The whole chain, one server',
      intro:
        'Find, download, organize, stream. Every link of a self-hosted media library, written once and shared, with nothing to wire between them.',
      items: {
        acquisition: {
          title: 'Automatic acquisition',
          body: 'Ask for a title: KROMA searches every one of your indexers, scores each release on resolution, codec, size, seeders and your keywords, grabs the best one, then imports and renames it Plex-style.',
          tag: 'decision engine · wanted-list',
        },
        vpn: {
          title: 'VPN with a real kill-switch',
          body: 'Paste a WireGuard config and all torrent traffic goes through a managed WireGuard→SOCKS5 bridge. A failed tunnel check pauses every download on the spot: no leak, no Gluetun to wire up.',
          tag: 'WireGuard → SOCKS5',
        },
        indexers: {
          title: 'Native indexers',
          body: 'A reimplemented Cardigann engine runs the tracker definitions from Jackett and Prowlarr, directly.',
          tag: 'Cardigann + Torznab',
        },
        downloader: {
          title: 'Download engine',
          body: 'A librqbit BitTorrent client fetches releases directly, driven by KROMA. Transmission and qBittorrent stay supported.',
          tag: 'librqbit',
        },
        player: {
          title: 'Direct-play player',
          body: 'Original files are streamed by byte range and decoded by the client. Video is never re-encoded.',
          tag: 'HEVC/H.265 · range-streamed',
        },
        ai: {
          title: 'On-device AI',
          body: 'Recommendations and semantic search over local embeddings, subtitles generated by Whisper. On your machine, no cloud.',
          tag: 'on-device · Whisper',
        },
        users: {
          title: 'Multi-user',
          body: 'Accounts, profiles, PIN locks, WebAuthn passkeys, invitations and per-user permissions. Share without opening everything up.',
          tag: 'profiles · PIN · passkeys',
        },
        stats: {
          title: 'Live statistics',
          body: 'Downloads, library scans and playback pushed in real time over a WebSocket bus, to dashboards and clients.',
          tag: 'WebSocket bus',
        },
      },
    },
    directPlay: {
      eyebrow: 'Direct-play, HEVC first',
      heading: 'The server [never transcodes] video.',
      lead: 'KROMA streams the original files by byte range; each client decodes HEVC/H.265 itself, in 10-bit and HDR, in hardware on Samsung and LG televisions. No transcoding pipeline, no CPU farm to keep warm.',
      exception:
        'One exception: an audio-only HLS stream for browsers that cannot decode AC3/EAC3/DTS. The video is copied, only the audio is transcoded to stereo AAC.',
      decodedBy: 'Decoded by the client',
      cpuLabel: 'NAS CPU during playback',
      cpuState: 'idle',
      cpuNote:
        'Nothing to re-encode: playback never wakes the processor. Your NAS stays free for everything else.',
    },
    platforms: {
      eyebrow: 'Platforms',
      title: 'The same KROMA, on every screen',
      intro:
        'The components and design tokens exist once, in a shared kit, and render natively, from the browser to the living room driven by a remote.',
      install: 'Install',
      tvDemo: 'TV demo',
      groups: { screens: 'Screens', televisions: 'Televisions', server: 'Server' },
      items: {
        web: { name: 'Web', detail: 'browser · responsive' },
        mobile: { name: 'Mobile', detail: 'iPhone · iPad · Android' },
        desktop: { name: 'Desktop', detail: 'macOS · Windows · Linux · Steam Deck' },
        samsung: { name: 'Samsung', detail: 'Tizen' },
        lg: { name: 'LG', detail: 'webOS' },
        androidTv: { name: 'Android TV', detail: 'Google TV' },
        appleTv: { name: 'Apple TV', detail: 'tvOS' },
        cast: { name: 'Cast', detail: 'phone → TV' },
        synology: { name: 'Synology', detail: '.spk package' },
        docker: { name: 'Docker', detail: 'multi-arch image' },
        raspberryPi: { name: 'Raspberry Pi', detail: 'arm64 64-bit' },
      },
    },
    selfHost: {
      eyebrow: 'Self-hosted',
      heading: 'Built to be [owned], not rented.',
      lead: 'Open source, under the GPL-2.0 license. No account to create, no subscription, no central service that could shut down. Your library and your activity never leave your network.',
      github: 'View on GitHub',
      terminal: 'start KROMA',
      points: {
        free: { title: 'Free', sub: 'Open source, GPL-2.0 license' },
        private: { title: 'Private', sub: 'Nothing leaves your network' },
        noCentral: { title: 'No central service', sub: 'No account, no subscription' },
        offline: { title: 'Offline', sub: 'Playback works without internet' },
      },
    },
    blogTeaser: {
      eyebrow: 'Journal',
      heading: 'From the blog',
      all: 'All articles',
    },
    finalCta: {
      heading: 'Take back control of your [media library].',
      lead: 'One binary to launch, your hardware, your files. No subscription, no data leaking out.',
      install: 'Install KROMA',
      code: 'View the code',
      legal: '© 2026 · free software · GPL-2.0 license',
    },
  },
} as const;

// The stable ids the sections key their structure by. Derived from the catalog so
// a component can never map over an id that has no copy.
export type FeatureId = keyof typeof home.en.features.items;
export type ReplacedId = keyof typeof home.en.oneBinary.replaces;
export type PlatformGroupId = keyof typeof home.en.platforms.groups;
export type PlatformId = keyof typeof home.en.platforms.items;
export type SelfHostPointId = keyof typeof home.en.selfHost.points;

/** The home page strings for the active locale. */
export function useHome() {
  return home[useLang()];
}
