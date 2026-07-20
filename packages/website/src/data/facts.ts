export const facts = [
  { n: '1', text: 'process to run. No sidecar services, no orchestration.' },
  { n: '0', text: 'video transcodes. Originals are streamed as-is, byte for byte.' },
  { n: '7', text: 'client platforms: web, macOS, Windows, Linux, Tizen, webOS, Android TV.' },
  { n: '6', text: 'tools it replaces, from request to playback.' },
] as const;

export const replaces = [
  { was: 'Sonarr + Radarr', now: 'Requests, wanted list, quality scoring' },
  { was: 'Prowlarr / Jackett', now: 'Native Cardigann engine, runs the same tracker definitions' },
  { was: 'qBittorrent', now: 'Embedded BitTorrent engine (librqbit), in-process' },
  { was: 'Gluetun', now: 'Managed WireGuard tunnel with a hard kill switch' },
  { was: 'Jellyfin / Plex', now: 'Direct-play server and clients for every screen' },
  { was: 'Overseerr', now: 'Per-user requests with approval permissions' },
] as const;

export const pipeline = [
  {
    title: 'Request',
    text: 'Search TMDB from any client and request what is missing. The wanted list keeps hunting until it lands.',
  },
  {
    title: 'Search',
    text: 'The built-in Cardigann engine queries your trackers directly, plus any Torznab endpoint.',
  },
  {
    title: 'Score',
    text: 'A decision engine ranks every release by resolution, codec, language and seed health, then picks one.',
  },
  {
    title: 'Download',
    text: 'The embedded torrent engine pulls it through your WireGuard tunnel. If the tunnel drops, transfers stop instantly.',
  },
  {
    title: 'Import',
    text: 'Files are renamed and organized, then enriched with TMDB metadata, artwork and chapter markers.',
  },
  {
    title: 'Play',
    text: 'The original file is range-streamed to whichever screen you are on. No re-encode, no waiting.',
  },
] as const;
