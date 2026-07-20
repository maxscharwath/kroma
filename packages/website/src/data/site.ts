import { readFileSync } from 'node:fs';

// The release version's single source of truth is server/Cargo.toml (the same
// file the release/desktop/synology workflows sed). Read it at build time so
// the hero badge and SoftwareApplication JSON-LD never publish a stale version.
// Build-time only — do not import this module from a client <script>.
function serverVersion(): string {
  try {
    const toml = readFileSync(new URL('../../../../server/Cargo.toml', import.meta.url), 'utf8');
    return toml.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export const site = {
  url: 'https://kroma.tv',
  title: 'KROMA · The self-hosted streaming stack in one binary',
  description:
    'KROMA finds, downloads, organizes and streams your media. Indexers, torrent engine, VPN kill switch, metadata, subtitles and apps for web, desktop and TV: one Rust binary, zero video transcoding, MIT licensed.',
  version: serverVersion(),
  github: 'https://github.com/maxscharwath/kroma',
  releases: 'https://github.com/maxscharwath/kroma/releases/latest',
  installGuide: 'https://github.com/maxscharwath/kroma/blob/main/INSTALL.md',
  license: 'https://github.com/maxscharwath/kroma/blob/main/LICENSE',
  packagesUrl: 'https://packages.kroma.tv',
  dockerImage: 'ghcr.io/maxscharwath/kroma:latest',
} as const;

export const dockerCommand = `docker run -d --name kroma \\
  -p 4040:4040 \\
  -v /path/to/movies:/media/movies:ro \\
  -v kroma-data:/data \\
  -e KROMA_MEDIA_DIRS=/media/movies \\
  ${site.dockerImage}`;
