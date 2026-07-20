export const features = [
  {
    k: 'Indexers',
    title: 'Cardigann, native',
    text: 'Runs the same tracker definitions Jackett and Prowlarr use, plus any Torznab endpoint.',
  },
  {
    k: 'Downloads',
    title: 'Torrents in-process',
    text: 'librqbit is embedded in the server. Transmission and qBittorrent still work if you prefer your own.',
  },
  {
    k: 'Network',
    title: 'WireGuard kill switch',
    text: 'Downloads run through a managed tunnel and pause the instant it drops. Announces are proxied.',
  },
  {
    k: 'AI, local',
    title: 'Nothing leaves home',
    text: 'Recommendations, semantic search and Whisper subtitles run on your hardware. No cloud calls.',
  },
  {
    k: 'Accounts',
    title: 'Multi-user, properly',
    text: 'Profiles, PIN locks, passkeys, invite links, per-user permissions and Quick Connect for TVs.',
  },
  {
    k: 'Clients',
    title: 'Every screen you own',
    text: 'Web, Samsung Tizen, LG webOS 2018+, Android TV, and a desktop app for macOS, Windows, Linux and Steam Deck.',
  },
  {
    k: 'Modules',
    title: 'A store for the server',
    text: 'Hot-loadable modules install, update and uninstall server features without a restart.',
  },
  {
    k: 'Operations',
    title: 'Admin console',
    text: 'Live dashboards, job scheduler, log console, storage management and a built-in remote-access tunnel.',
  },
] as const;
