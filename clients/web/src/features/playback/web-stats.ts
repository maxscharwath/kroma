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
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
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

/**
 * Build the "stats for nerds" snapshot (§9) for the shared StatsPanel from the
 * web `<video>` + HLS internals. The headline fields map to PlayerStats; the HLS
 * transport diagnostics ride in `extra`.
 */
export function buildWebStats(s: WebStatsInput): PlayerStats {
  const { v, item, cur, dur, bufEnd, useHls, aac, anchor, baseSec, audioTracks, audioIndex, t } = s;
  const vw = v?.videoWidth || item.video?.width || 0;
  const vh = v?.videoHeight || item.video?.height || 0;
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const dw = v ? Math.round(v.clientWidth * dpr) : 0;
  const dh = v ? Math.round(v.clientHeight * dpr) : 0;
  const q = v?.getVideoPlaybackQuality?.();
  const dropped = q?.droppedVideoFrames ?? 0;
  const totalFrames = q?.totalVideoFrames ?? 0;
  const bufferAhead = Math.max(0, bufEnd - cur);
  const avgMbps = s.bytes && dur ? (s.bytes * 8) / dur / 1e6 : 0;
  const conn =
    (typeof navigator !== 'undefined'
      ? (navigator as Navigator & { connection?: ConnLike }).connection
      : undefined) ?? {};
  const vcodec = item.video?.codec?.toUpperCase() ?? '-';
  const selAudio = audioTracks.find((a) => a.index === audioIndex) ?? audioTracks[0];
  const acodec = selAudio?.codec?.toUpperCase() ?? item.audio?.codec?.toUpperCase() ?? '-';
  const rel = v?.currentTime ?? 0;

  const extra: { label: string; value: string }[] = [
    { label: t('stats.title2'), value: item.title },
    { label: t('stats.container'), value: item.container.toUpperCase() },
    {
      label: t('stats.position'),
      value: useHls ? `${clock(cur)} · rel ${rel.toFixed(0)}s` : clock(cur),
    },
    { label: t('stats.display'), value: dw && dh ? `${dw}×${dh} @${dpr}x` : '-' },
    {
      label: t('stats.size'),
      value: s.bytes ? `${(s.bytes / 1e9).toFixed(2)} Go` : '…',
    },
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
    extra.splice(3, 0, {
      label: t('stats.anchor'),
      value: `${clock(anchor)} (${baseSec.toFixed(0)}s)`,
    });
  }

  return {
    mode: useHls ? `HLS · ${aac ? 'AAC' : 'copy'}` : 'Direct',
    resolution: vw && vh ? `${vw}×${vh}` : undefined,
    videoCodec: `${vcodec}${item.video?.bitDepth ? ` ${item.video.bitDepth}-bit` : ''}${item.video?.hdr ? ' HDR' : ''}`,
    audioFormat: `${acodec}${selAudio?.channels ? ` ${selAudio.channels}.0` : ''}${selAudio?.language ? ` (${selAudio.language})` : ''}`,
    bitrate: avgMbps ? `${avgMbps.toFixed(2)} Mb/s` : undefined,
    buffer: t('stats.bufferAhead', { seconds: bufferAhead.toFixed(1) }),
    dropped: `${dropped} / ${totalFrames}`,
    extra,
  };
}
