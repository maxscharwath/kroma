import type { AudioTrack, Translate } from '@kroma/core';
import type { PlayerStats } from '@kroma/ui';
import type { MovieView } from '#web/shared/lib/api';

/** Format seconds as `H:MM:SS` (or `M:SS`). */
function clock(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = h ? String(m).padStart(2, '0') : String(m);
  const hours = h ? `${h}:` : '';
  return `${hours}${mm}:${String(sec).padStart(2, '0')}`;
}

const READY = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT', 'HAVE_FUTURE', 'HAVE_ENOUGH'];
const NETWORK = ['EMPTY', 'IDLE', 'LOADING', 'NO_SOURCE'];

interface ConnLike {
  downlink?: number;
  effectiveType?: string;
}

export interface WebStatsInput {
  v: HTMLVideoElement | null;
  item: MovieView;
  cur: number;
  dur: number;
  bufEnd: number;
  useHls: boolean;
  aac: boolean;
  anchor: number;
  baseSec: number;
  audioTracks: AudioTrack[];
  audioIndex: number;
  hlsRef: { current: import('hls.js').default | null };
  /** Total stream size in bytes (one-shot range probe), for the average bitrate. */
  bytes: number;
  t: Translate;
}

interface StatsMetrics {
  vw: number;
  vh: number;
  dpr: number;
  dw: number;
  dh: number;
  dropped: number;
  totalFrames: number;
  bufferAhead: number;
  avgMbps: number;
  conn: ConnLike;
  rel: number;
}

/** Read the live playback metrics off the `<video>` element and the input. */
function computeMetrics(s: WebStatsInput): StatsMetrics {
  const { v, item, cur, dur, bufEnd } = s;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const q = v?.getVideoPlaybackQuality?.();
  const conn =
    (typeof navigator !== 'undefined'
      ? (navigator as Navigator & { connection?: ConnLike }).connection
      : undefined) ?? {};
  return {
    vw: v?.videoWidth || item.video?.width || 0,
    vh: v?.videoHeight || item.video?.height || 0,
    dpr,
    dw: v ? Math.round(v.clientWidth * dpr) : 0,
    dh: v ? Math.round(v.clientHeight * dpr) : 0,
    dropped: q?.droppedVideoFrames ?? 0,
    totalFrames: q?.totalVideoFrames ?? 0,
    bufferAhead: Math.max(0, bufEnd - cur),
    avgMbps: s.bytes && dur ? (s.bytes * 8) / dur / 1e6 : 0,
    conn,
    rel: v?.currentTime ?? 0,
  };
}

/** The "video codec" headline string (codec + bit depth + HDR). */
function videoCodecLabel(item: MovieView): string {
  const vcodec = item.video?.codec?.toUpperCase() ?? '-';
  const depth = item.video?.bitDepth ? ` ${item.video.bitDepth}-bit` : '';
  const hdr = item.video?.hdr ? ' HDR' : '';
  return `${vcodec}${depth}${hdr}`;
}

/** The "audio format" headline string (codec + channels + language). */
function audioFormatLabel(selAudio: AudioTrack | undefined, item: MovieView): string {
  const acodec = selAudio?.codec?.toUpperCase() ?? item.audio?.codec?.toUpperCase() ?? '-';
  const channels = selAudio?.channels ? ` ${selAudio.channels}.0` : '';
  const language = selAudio?.language ? ` (${selAudio.language})` : '';
  return `${acodec}${channels}${language}`;
}

/** The verbose HLS/transport diagnostics rows shown under the headline fields. */
function statsRows(s: WebStatsInput, m: StatsMetrics): { label: string; value: string }[] {
  const { v, item, cur, useHls, anchor, baseSec, t } = s;
  const { dw, dh, dpr, rel, conn } = m;
  const position = useHls ? `${clock(cur)} · rel ${rel.toFixed(0)}s` : clock(cur);
  const rows: { label: string; value: string }[] = [
    { label: t('stats.title2'), value: item.title },
    { label: t('stats.container'), value: item.container.toUpperCase() },
    { label: t('stats.position'), value: position },
    { label: t('stats.display'), value: dw && dh ? `${dw}×${dh} @${dpr}x` : '-' },
    { label: t('stats.size'), value: s.bytes ? `${(s.bytes / 1e9).toFixed(2)} Go` : '…' },
    {
      label: t('stats.volume'),
      value: `${Math.round((v?.volume ?? 1) * 100)}%${v?.muted ? t('stats.volumeMuted') : ''}`,
    },
    {
      label: t('stats.state'),
      value: `${READY[v?.readyState ?? 0]} · NET_${NETWORK[v?.networkState ?? 0]}`,
    },
    {
      label: t('stats.connection'),
      value: conn.downlink ? `${conn.downlink} Mb/s · ${conn.effectiveType ?? ''}` : '-',
    },
  ];
  if (useHls) {
    rows.splice(3, 0, {
      label: t('stats.anchor'),
      value: `${clock(anchor)} (${baseSec.toFixed(0)}s)`,
    });
  }
  return rows;
}

/**
 * Build the "stats for nerds" snapshot (§9) for the shared StatsPanel from the
 * web `<video>` + HLS internals. The headline fields map to PlayerStats; the HLS
 * transport diagnostics ride in `extra`.
 */
export function buildWebStats(s: WebStatsInput): PlayerStats {
  const { item, useHls, aac, audioTracks, audioIndex, t } = s;
  const m = computeMetrics(s);
  const selAudio = audioTracks.find((a) => a.index === audioIndex) ?? audioTracks[0];
  const codecMode = aac ? 'AAC' : 'copy';
  const mode = useHls ? `HLS · ${codecMode}` : 'Direct';

  return {
    mode,
    resolution: m.vw && m.vh ? `${m.vw}×${m.vh}` : undefined,
    videoCodec: videoCodecLabel(item),
    audioFormat: audioFormatLabel(selAudio, item),
    bitrate: m.avgMbps ? `${m.avgMbps.toFixed(2)} Mb/s` : undefined,
    buffer: t('stats.bufferAhead', { seconds: m.bufferAhead.toFixed(1) }),
    dropped: `${m.dropped} / ${m.totalFrames}`,
    extra: statsRows(s, m),
  };
}
