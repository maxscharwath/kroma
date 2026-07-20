export interface Qa {
  q: string;
  /** Answer as inline HTML (links allowed); also used for the FAQPage JSON-LD after tag-stripping. */
  a: string;
}

export const faq: Qa[] = [
  {
    q: 'Does it really never transcode video?',
    a: "Yes. The server range-streams the original file and your device decodes H.265 natively, including 10-bit HDR. The single exception is audio: when a browser can't decode AC3, EAC3 or DTS, KROMA copies the video stream untouched and re-encodes only the audio to stereo AAC.",
  },
  {
    q: 'What hardware do I need?',
    a: 'Any NAS or spare machine running Linux, macOS or Windows. No GPU is required and there is no transcode farm to size: during playback the CPU is essentially idle. The whole server is one binary with an embedded SQLite database.',
  },
  {
    q: 'Which TVs are supported?',
    a: 'Samsung Tizen, LG webOS from 2018 onward, and Android TV / Google TV including the Chromecast with Google TV. There\'s also a desktop app for macOS, Windows, Linux and Steam Deck, and the web app runs in any modern browser. Install steps for each are in the <a href="https://github.com/maxscharwath/kroma/blob/main/INSTALL.md" rel="noopener">TV guide</a>.',
  },
  {
    q: 'Where does my data go?',
    a: 'Nowhere. Your library, watch history, recommendations and generated subtitles are computed and stored on your machine. The only outbound requests are TMDB metadata lookups and the trackers you configure yourself.',
  },
  {
    q: 'How is this different from Jellyfin + the *arr stack?',
    a: "It's one process instead of six. Sonarr, Radarr, Prowlarr, qBittorrent, Gluetun and Overseerr each mean another service, config and update cycle; KROMA does acquisition and playback in-process against one library, so there is nothing to wire together and nothing to fall out of sync.",
  },
  {
    q: 'What does it cost?',
    a: 'Nothing. KROMA is MIT-licensed open source. There is no account, no telemetry and no paid tier. If it\'s useful, <a href="https://github.com/maxscharwath/kroma" rel="noopener">a star on GitHub</a> is the whole business model.',
  },
];
