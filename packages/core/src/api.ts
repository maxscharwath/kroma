import type {
  Activity,
  AuthResult,
  ContinueItem,
  Health,
  Invite,
  InviteCreated,
  Library,
  MediaItem,
  Metadata,
  Permission,
  ProgressEntry,
  PublicUser,
  QuickConnectInit,
  QuickConnectStatus,
  ScanResult,
  Show,
  ShowDetail,
  User,
} from './types';

export interface LumaClientOptions {
  /** Base server origin, e.g. "http://nas.local:4040". No trailing slash. */
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  /** Bearer token for per-user endpoints (progress, profile). Optional — the
   * catalogue is public. Can be set later with {@link LumaClient.setAuthToken}. */
  authToken?: string;
}

/** Thin typed client over the LUMA server REST API. Shared by every client shell. */
export class LumaClient {
  readonly baseUrl: string;
  private readonly fetchFn: typeof globalThis.fetch;
  private authToken?: string;

  constructor(options: LumaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.authToken = options.authToken;
    // Warm the connection to the media server as early as possible.
    preconnect(this.baseUrl);
  }

  /** Set (or clear, with `undefined`) the bearer token sent on every request. */
  setAuthToken(token?: string): void {
    this.authToken = token;
  }

  /** Whether a bearer token is currently set (does not validate it). */
  get hasAuth(): boolean {
    return Boolean(this.authToken);
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    if (this.authToken) headers.set('Authorization', `Bearer ${this.authToken}`);
    const res = await this.fetchFn(`${this.baseUrl}/api${path}`, { ...init, headers });
    if (!res.ok) {
      throw new LumaApiError(res.status, `${init?.method ?? 'GET'} ${path} failed (${res.status})`);
    }
    // 204 No Content (progress writes) → nothing to parse.
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  health(): Promise<Health> {
    return this.json<Health>('/health');
  }

  libraries(): Promise<Library[]> {
    return this.json<Library[]>('/libraries');
  }

  /** All playable items (movies + episodes). */
  items(libraryId?: string): Promise<MediaItem[]> {
    return this.json<MediaItem[]>(`/items${libraryQuery(libraryId)}`);
  }

  /** Movies only (excludes episodes). */
  movies(libraryId?: string): Promise<MediaItem[]> {
    return this.json<MediaItem[]>(`/movies${libraryQuery(libraryId)}`);
  }

  /** TV shows (aggregates). */
  shows(libraryId?: string): Promise<Show[]> {
    return this.json<Show[]>(`/shows${libraryQuery(libraryId)}`);
  }

  /** One show with its seasons + episodes. */
  show(id: string): Promise<ShowDetail> {
    return this.json<ShowDetail>(`/shows/${encodeURIComponent(id)}`);
  }

  item(id: string): Promise<MediaItem> {
    return this.json<MediaItem>(`/items/${encodeURIComponent(id)}`);
  }

  scan(): Promise<ScanResult> {
    return this.json<ScanResult>('/scan', { method: 'POST' });
  }

  /** Live scan/enrichment status snapshot. */
  status(): Promise<Activity> {
    return this.json<Activity>('/status');
  }

  /** URL of the server's recent log lines (text/plain). */
  logsUrl(tail = 200): string {
    return `${this.baseUrl}/api/logs?tail=${tail}`;
  }

  /** Fetch the last `tail` lines of the server log as plain text. */
  async logs(tail = 200): Promise<string> {
    const res = await this.fetchFn(this.logsUrl(tail));
    if (!res.ok) throw new LumaApiError(res.status, `GET /logs failed (${res.status})`);
    return res.text();
  }

  /** Direct-play stream URL for a `<video>` src. Range requests are served by the server. */
  streamUrl(id: string): string {
    return `${this.baseUrl}/api/items/${encodeURIComponent(id)}/stream`;
  }

  /** HLS playlist URL for the audio-transcode variant: the server copies the
   * video stream untouched and re-encodes only the audio to stereo AAC. Use it
   * when the runtime can decode the video codec but not the source audio
   * (AC3/EAC3/DTS/TrueHD) — see {@link audioSupport}. Needs hls.js outside Safari. */
  hlsAudioUrl(id: string): string {
    return `${this.baseUrl}/api/items/${encodeURIComponent(id)}/hls/index.m3u8`;
  }

  /** Generated SVG poster URL for a movie/episode. */
  posterUrl(id: string): string {
    return `${this.baseUrl}/api/items/${encodeURIComponent(id)}/poster`;
  }

  /** Generated SVG poster URL for a show. */
  showPosterUrl(id: string): string {
    return `${this.baseUrl}/api/shows/${encodeURIComponent(id)}/poster`;
  }

  /** Resolve a metadata image URL against the server origin. Cached WebP art is
   * stored as a relative path (`/api/images/…`); TMDB fallbacks are absolute. */
  resolveArt(url?: string | null): string | null {
    if (!url) return null;
    return /^https?:\/\//.test(url) ? url : `${this.baseUrl}${url}`;
  }

  /** Best poster for a movie/episode: real cached TMDB art if resolved, else the
   * generated SVG placeholder. */
  posterFor(item: Pick<MediaItem, 'id' | 'metadata'>): string {
    return this.resolveArt(item.metadata?.posterUrl) ?? this.posterUrl(item.id);
  }

  /** Best poster for a show: real cached TMDB art if resolved, else the SVG. */
  showPosterFor(show: Pick<Show, 'id' | 'metadata'>): string {
    return this.resolveArt(show.metadata?.posterUrl) ?? this.showPosterUrl(show.id);
  }

  /** Cover/backdrop art for a movie or show, or `null` when none was resolved. */
  backdropFor(x: { metadata?: Metadata | null }): string | null {
    return this.resolveArt(x.metadata?.backdropUrl);
  }

  /** WebVTT URL for the n-th embedded subtitle track of an item. The server
   * extracts text subtitles on demand (`GET /api/items/:id/subtitles/:n.vtt`). */
  subtitleUrl(id: string, index: number): string {
    return `${this.baseUrl}/api/items/${encodeURIComponent(id)}/subtitles/${index}.vtt`;
  }

  // ----- accounts / sessions --------------------------------------------------

  /** Create an account and open a session. After the first (owner) account,
   * `inviteToken` is required — registration is invite-only. Does NOT set the
   * token; the caller persists it (then calls {@link setAuthToken}). */
  register(email: string, username: string, password: string, inviteToken?: string): Promise<AuthResult> {
    return this.json<AuthResult>('/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, username, password, inviteToken }),
    });
  }

  // ----- invitations ----------------------------------------------------------

  /** Mint a registration invite (requires `users.manage`). */
  createInvite(opts?: { permissions?: Permission[]; expiresInDays?: number }): Promise<InviteCreated> {
    return this.json<InviteCreated>('/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(opts ?? {}),
    });
  }

  /** Pending invites (requires `users.manage`). */
  invites(): Promise<Invite[]> {
    return this.json<Invite[]>('/invites');
  }

  /** Check an invite token's validity (public — used by the join page). */
  checkInvite(token: string): Promise<{ valid: boolean; expiresAt?: number }> {
    return this.json<{ valid: boolean; expiresAt?: number }>(`/invites/${encodeURIComponent(token)}`);
  }

  /** Revoke an invite (requires `users.manage`). */
  async revokeInvite(token: string): Promise<void> {
    await this.json<void>(`/invites/${encodeURIComponent(token)}`, { method: 'DELETE' });
  }

  /** Log in with email-or-username + password → `{ token, user }`. */
  login(identifier: string, password: string): Promise<AuthResult> {
    return this.json<AuthResult>('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: identifier, password }),
    });
  }

  /** Invalidate the current session server-side (then clear the token locally). */
  async logout(): Promise<void> {
    await this.json<void>('/auth/logout', { method: 'POST' });
  }

  /** The currently-authenticated user (requires a token). */
  me(): Promise<{ user: User }> {
    return this.json<{ user: User }>('/auth/me');
  }

  /** Public profile list for the "Qui regarde ?" picker (no emails). */
  users(): Promise<PublicUser[]> {
    return this.json<PublicUser[]>('/users');
  }

  /** Upload the current user's avatar (raw image bytes) → its cached WebP URL. */
  uploadAvatar(file: Blob): Promise<{ avatarUrl: string }> {
    return this.json<{ avatarUrl: string }>('/users/avatar', {
      method: 'POST',
      headers: { 'content-type': file.type || 'application/octet-stream' },
      body: file,
    });
  }

  // ----- playback progress / resume -------------------------------------------

  /** All of the user's saved positions. */
  progress(): Promise<ProgressEntry[]> {
    return this.json<ProgressEntry[]>('/progress');
  }

  /** Saved position for a single item, or null if none. */
  itemProgress(itemId: string): Promise<ProgressEntry | null> {
    return this.json<ProgressEntry | null>(`/progress/${encodeURIComponent(itemId)}`);
  }

  /** Resumable items, newest first (the "Reprendre la lecture" rail). */
  continueWatching(): Promise<ContinueItem[]> {
    return this.json<ContinueItem[]>('/continue');
  }

  /** Save (upsert) the playback position for an item. */
  async saveProgress(itemId: string, positionMs: number, durationMs?: number | null): Promise<void> {
    await this.json<void>(`/progress/${encodeURIComponent(itemId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ positionMs: Math.round(positionMs), durationMs: durationMs ?? null }),
    });
  }

  /** Forget an item's position (finished / removed from Continue Watching). */
  async deleteProgress(itemId: string): Promise<void> {
    await this.json<void>(`/progress/${encodeURIComponent(itemId)}`, { method: 'DELETE' });
  }

  // ----- quick connect (device pairing) ---------------------------------------

  /** Start a Quick Connect request → a code to display + a secret to poll with. */
  quickConnectInitiate(): Promise<QuickConnectInit> {
    return this.json<QuickConnectInit>('/auth/quickconnect/initiate', { method: 'POST' });
  }

  /** Poll a Quick Connect request by its secret. */
  quickConnectPoll(secret: string): Promise<QuickConnectStatus> {
    return this.json<QuickConnectStatus>(`/auth/quickconnect/poll?secret=${encodeURIComponent(secret)}`);
  }

  /** Approve a device's Quick Connect code (requires the approver's token). */
  async quickConnectAuthorize(code: string): Promise<void> {
    await this.json<void>('/auth/quickconnect/authorize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
  }
}

function libraryQuery(libraryId?: string): string {
  return libraryId ? `?library=${encodeURIComponent(libraryId)}` : '';
}

/** Add a `<link rel="preconnect">` to the server origin (no-op off-DOM / if dup). */
function preconnect(baseUrl: string): void {
  if (typeof document === 'undefined') return;
  try {
    const origin = new URL(baseUrl).origin;
    if (document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  } catch {
    /* invalid URL or no DOM — ignore */
  }
}

export class LumaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'LumaApiError';
  }
}
