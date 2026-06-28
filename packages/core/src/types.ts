// Wire types shared by every LUMA client. These MUST stay in sync with the
// Rust server's JSON model (see server/src/model.rs).

export type VideoCodec = 'hevc' | 'h264' | 'av1' | 'vp9' | 'mpeg2' | 'mpeg4' | string;
export type AudioCodec = 'aac' | 'eac3' | 'ac3' | 'dts' | 'truehd' | 'flac' | 'opus' | 'mp3' | string;
export type MediaKind = 'movie' | 'episode' | 'video';
export type LibraryKind = 'movies' | 'shows' | 'mixed';

export interface VideoTrack {
  codec: VideoCodec;
  width: number | null;
  height: number | null;
  /** HDR10 / HLG signalled by the source. */
  hdr: boolean;
  /** 8 / 10 / 12. Null when unknown. */
  bitDepth: number | null;
}

export interface AudioTrack {
  codec: AudioCodec;
  channels: number | null;
  language: string | null;
}

export interface SubtitleTrack {
  language: string | null;
  codec: string;
}

/**
 * TMDB catalog metadata, resolved server-side during a scan. Image URLs are
 * locally-cached WebP paths (relative, e.g. `/api/images/<hash>.webp`) when the
 * server cached them, otherwise absolute `image.tmdb.org` URLs. Use
 * `LumaClient.posterFor` / `backdropFor` to resolve them against the origin.
 */
export interface Metadata {
  provider: 'tmdb' | string;
  tmdbId: number;
  imdbId?: string | null;
  title?: string | null;
  tagline?: string | null;
  overview?: string | null;
  releaseDate?: string | null;
  genres: string[];
  rating?: number | null;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  /** Stylised title-treatment logo (transparent PNG path), when TMDB has one. */
  logoUrl?: string | null;
  /** Top-billed cast (TMDB credits). Absent on metadata resolved before the
   * server started fetching credits. */
  cast?: CastMember[];
  tmdbUrl: string;
}

/** A top-billed cast member surfaced in the detail page's "Distribution". */
export interface CastMember {
  name: string;
  /** The character they play, when TMDB provides one. */
  character?: string | null;
  /** Profile photo — a locally-cached WebP path (`/api/images/…`) when the
   * server cached it, else an absolute TMDB URL, else absent. Resolve against
   * the origin with `LumaClient.resolveArt`. */
  profileUrl?: string | null;
}

export interface MediaItem {
  id: string;
  title: string;
  kind: MediaKind;
  year: number | null;
  durationMs: number | null;
  /** Container/extension, e.g. "mkv", "mp4". */
  container: string;
  video: VideoTrack | null;
  audio: AudioTrack | null;
  subtitles: SubtitleTrack[];
  /** Owning library id. */
  library: string;
  // --- show / episode grouping (null for movies) ---
  showId: string | null;
  showTitle: string | null;
  season: number | null;
  episode: number | null;
  /** Last episode number for multi-episode files (`S01E02-E03`). */
  episodeEnd: number | null;
  episodeTitle: string | null;
  /** Path relative to the library root. Null for built-in demo items. */
  relPath: string | null;
  /** ISO-8601. */
  addedAt: string;
  /** TMDB metadata (movies). Absent until background enrichment resolves it. */
  metadata?: Metadata | null;
}

/** A TV show aggregate (not a file) — built by grouping episodes during a scan. */
export interface Show {
  id: string;
  title: string;
  year: number | null;
  library: string;
  seasonCount: number;
  episodeCount: number;
  /** Representative video info (highest-res episode) for quality badges. */
  video: VideoTrack | null;
  addedAt: string;
  /** TMDB metadata (show-level). Absent until background enrichment resolves it. */
  metadata?: Metadata | null;
}

/** One season's episodes, sorted by episode number. */
export interface Season {
  number: number;
  episodes: MediaItem[];
}

/** `GET /api/shows/:id` payload. */
export interface ShowDetail {
  show: Show;
  seasons: Season[];
}

export interface Library {
  id: string;
  name: string;
  kind: LibraryKind;
  path: string;
  itemCount: number;
}

export interface Health {
  status: 'ok' | string;
  version: string;
  /** Whether the server found an `ffprobe` binary at startup. */
  ffprobe: boolean;
  libraries: number;
  items: number;
  shows: number;
}

export interface ScanResult {
  scanned: number;
  libraries: number;
  shows: number;
}

/** A user account (never carries the password). */
/** A granular capability. Mirrors the server's `Permission` enum; extend both
 * sides together (e.g. a future `stats.view`). Kept open (`| string`) so a
 * client built before a new permission still parses it. */
export type Permission = 'users.manage' | 'library.manage' | 'settings.manage' | 'playback' | string;

export interface User {
  id: string;
  email: string;
  username: string;
  /** Cached WebP avatar (`/api/images/…`), or absent → fall back to initials. */
  avatarUrl?: string | null;
  /** Granted capabilities (no roles — capability-based). Clients unlock pages
   * and actions from this set. The owner account holds every permission. */
  permissions: Permission[];
  createdAt: string;
}

/** True if the user holds `perm`. */
export function hasPermission(user: Pick<User, 'permissions'>, perm: Permission): boolean {
  return user.permissions.includes(perm);
}

/** The public subset of a user for the "Qui regarde ?" picker (no email). */
export interface PublicUser {
  id: string;
  username: string;
  avatarUrl?: string | null;
}

/** A registration invitation (created by a user with `users.manage`). */
export interface Invite {
  token: string;
  permissions: Permission[];
  createdBy?: string | null;
  createdAt: string;
  /** Unix-seconds expiry. */
  expiresAt: number;
  used: boolean;
}

/** `POST /api/invites` result — the invite plus a ready-to-share join URL. */
export interface InviteCreated {
  token: string;
  /** `<web>/join?invite=…` when the server knows the web URL, else null. */
  url?: string | null;
  permissions: Permission[];
  expiresAt: number;
}

/** `{ token, user }` returned by register/login. */
export interface AuthResult {
  token: string;
  user: User;
}

/** One saved playback position. */
export interface ProgressEntry {
  itemId: string;
  positionMs: number;
  durationMs: number | null;
  updatedAt: string;
}

/** `POST /api/auth/quickconnect/initiate` — a device-pairing request. */
export interface QuickConnectInit {
  /** Short numeric code shown on the device. */
  code: string;
  /** Private handle the device polls with. */
  secret: string;
  expiresInSec: number;
  /** Web URL to approve the code (for a QR), when the server knows it. */
  authorizeUrl?: string | null;
}

/** `GET /api/auth/quickconnect/poll` result. */
export type QuickConnectStatus =
  | { status: 'pending' }
  | { status: 'expired' }
  | { status: 'authorized'; token: string; user: User };

/** A resumable item plus where to resume from (`GET /api/continue`). */
export interface ContinueItem {
  item: MediaItem;
  positionMs: number;
  durationMs: number | null;
  updatedAt: string;
}

/** `GET /api/status` — live scan/enrichment snapshot. */
export interface Activity {
  phase: 'idle' | 'scanning' | 'enriching' | 'ready' | string;
  scanning: boolean;
  libraries: number;
  shows: number;
  items: number;
  enrichDone: number;
  enrichTotal: number;
  lastScanAt: string | null;
}
