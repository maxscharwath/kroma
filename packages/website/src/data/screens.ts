export interface Screen {
  img: string;
  alt: string;
  caption: string;
  tag: string;
  title: string;
  body: string;
  points: { lead: string; rest: string }[];
}

export const screens: Screen[] = [
  {
    img: 'player',
    alt: 'KROMA player streaming Blade Runner 2049 at 1h37 with seek bar, subtitle and audio controls, and an Up next shelf',
    caption: 'Shot 01 · The player, mid-film',
    tag: 'Direct-play',
    title: 'The server sends bytes, not frames.',
    body: "This is Blade Runner 2049 playing from an untouched H.265 file. The server's job ended at reading the disk; the decoding happens on your device, in hardware.",
    points: [
      { lead: '10-bit HDR', rest: 'passes through to TVs that render it' },
      {
        lead: 'Audio fallback only:',
        rest: "AC3/EAC3/DTS becomes AAC when a browser can't decode it, video stays untouched",
      },
      { lead: 'Night mode', rest: 'levels loud scenes on every client' },
    ],
  },
  {
    img: 'movie-detail',
    alt: 'KROMA movie page for Dune (2021) with 4K, HDR and H.265 badges, director credit, cast portraits and processing status',
    caption: 'Shot 02 · A movie page',
    tag: 'Metadata',
    title: 'Every file, fully identified.',
    body: 'TMDB enrichment in your language, cast and crew, audio and subtitle tracks read straight from the container, and a per-title ledger showing exactly what the pipeline did.',
    points: [
      { lead: '4K · HDR · H.265 badges', rest: 'come from probing the actual file' },
      { lead: 'Multi-language cache:', rest: 'French and English out of the box' },
      {
        lead: 'Whisper subtitles',
        rest: 'generated on your GPU when a release ships without them',
      },
    ],
  },
  {
    img: 'search',
    alt: 'KROMA search results for the query spider, showing a grid of Spider-Man posters from the library',
    caption: 'Shot 03 · Search, mid-query',
    tag: 'Search & requests',
    title: 'One box for what you have and what you want.',
    body: "Search covers your library and TMDB in the same view. Anything you don't have yet is one click from being requested, scored and downloaded.",
    points: [
      { lead: 'Semantic search', rest: 'with on-device embeddings' },
      { lead: 'Per-user requests', rest: 'gated by capability permissions' },
      { lead: 'Recommendations', rest: 'computed locally, never sent anywhere' },
    ],
  },
  {
    img: 'show-detail',
    alt: 'KROMA series page for Severance showing three seasons, nineteen episodes, cast and processing treatments',
    caption: 'Shot 04 · A series page',
    tag: 'Series',
    title: 'Seasons, markers, resume. Everywhere.',
    body: 'Episode tracking with skip-intro markers detected server-side, and a continue-watching row that follows you from the browser to the couch.',
    points: [
      { lead: 'Intro and credits markers', rest: ', detected automatically' },
      { lead: 'Resume position', rest: 'synced across every device' },
      { lead: 'Profiles', rest: 'with PIN locks, passkeys and invites' },
    ],
  },
];
