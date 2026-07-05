// One row of the downloads queue: release name + target pill, live progress
// bar (WS-fed), speed, seeders-side stats, client pill, status and actions.

import type { DownloadView, MessageKey } from '@luma/core';
import { useT } from '@luma/ui';
import {
  IconExternalLink,
  IconMovie,
  IconPlayerPause,
  IconPlayerPlay,
  IconRefresh,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { ProgressBar } from '#web/features/admin/ui';
import { formatBytes } from '#web/shared/lib/adminFormat';

/** Live per-download overlay fed by `download.progress` WS frames. */
export interface LiveDl {
  progress: number;
  downBps: number;
  upBps: number;
  peers: number;
  peersSeen: number;
  state: string;
}

const STATUS_COLOR: Record<string, string> = {
  queued: 'rgba(244,243,240,.55)',
  downloading: '#F4B642',
  seeding: '#46D08D',
  completed: '#46D08D',
  imported: '#46D08D',
  paused: 'rgba(244,243,240,.55)',
  failed: '#E8536A',
  removed: 'rgba(244,243,240,.4)',
};

export function DownloadRowView({
  dl,
  live,
  busy,
  onPause,
  onResume,
  onRetry,
  onRemove,
}: Readonly<{
  dl: DownloadView;
  live?: LiveDl;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onRemove: () => void;
}>) {
  const t = useT();
  const status = live?.state && dl.status !== 'imported' ? live.state : dl.status;
  const progress = live?.progress ?? dl.progress;
  const color = STATUS_COLOR[status] ?? 'rgba(244,243,240,.55)';
  const active = status === 'downloading' || status === 'queued';
  const pausable = active;
  const resumable = status === 'paused';
  // Retry a failed grab (re-download) OR a completed download whose import
  // errored (re-import, e.g. after a library volume comes back online).
  const retryable = status === 'failed' || (status === 'completed' && Boolean(dl.error));

  const targetLabel =
    dl.kind === 'season'
      ? `S${String(dl.season ?? 0).padStart(2, '0')}`
      : dl.kind === 'episode'
        ? `S${String(dl.season ?? 0).padStart(2, '0')}E${String(dl.episodes?.[0] ?? 0).padStart(2, '0')}`
        : null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_190px_120px_110px_84px] items-center gap-4 border-b border-white/[0.04] px-5 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {dl.posterUrl ? (
          <img
            src={dl.posterUrl}
            alt=""
            loading="lazy"
            className="h-11 w-[30px] flex-[0_0_auto] rounded-[3px] bg-white/5 object-cover"
          />
        ) : (
          <div className="flex h-11 w-[30px] flex-[0_0_auto] items-center justify-center rounded-[3px] bg-white/[0.05]">
            <IconMovie size={13} className="text-white/25" />
          </div>
        )}
        <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="truncate text-[13.5px] font-bold" title={dl.releaseTitle}>
            {dl.title}
          </span>
          {targetLabel ? (
            <span className="flex-[0_0_auto] rounded-full bg-[#86A8FF]/[0.14] px-[7px] py-0.5 text-[9px] font-bold text-[#86A8FF]">
              {targetLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-[3px] flex items-center gap-1.5 text-[11.5px] font-medium text-white/40">
          <span className="truncate" title={dl.releaseTitle}>
            {dl.releaseTitle}
          </span>
          {dl.indexerName ? (
            <span className="flex-[0_0_auto] text-white/30">· {dl.indexerName}</span>
          ) : null}
          {dl.detailsUrl ? (
            <a
              href={dl.detailsUrl}
              target="_blank"
              rel="noreferrer"
              title={t('downloads.viewOnTracker')}
              className="flex-[0_0_auto] text-white/40 hover:text-accent"
            >
              <IconExternalLink size={12} stroke={2} />
            </a>
          ) : null}
        </div>
        {dl.error ? (
          <div className="mt-1 truncate text-[11.5px] font-semibold text-[#EF8091]">{dl.error}</div>
        ) : null}
        </div>
      </div>

      <div>
        <ProgressBar pct={progress * 100} color={color} height={5} />
        <div className="mt-1 flex items-center justify-between text-[11px] font-semibold tabular-nums text-white/45">
          <span>{Math.round(progress * 100)}%</span>
          {dl.sizeBytes != null ? <span>{formatBytes(dl.sizeBytes)}</span> : null}
        </div>
      </div>

      <div className="text-[11.5px] font-semibold tabular-nums text-white/55">
        {live && active ? (
          <>
            <div className="text-[#46D08D]">{formatBytes(live.downBps)}/s</div>
            <div className="flex items-center gap-1.5 text-white/35">
              <span>{formatBytes(live.upBps)}/s</span>
              <span
                className={`flex items-center gap-0.5 ${live.peers > 0 ? 'text-[#86A8FF]' : 'text-[#F4B642]'}`}
                title={t('downloads.peersDetail', {
                  live: String(live.peers),
                  seen: String(live.peersSeen),
                })}
              >
                <IconUsers size={11} stroke={2} />
                {live.peersSeen > live.peers ? `${live.peers}/${live.peersSeen}` : live.peers}
              </span>
            </div>
          </>
        ) : (
          <span className="text-white/30">-</span>
        )}
      </div>

      <div>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-[10px] py-[4px] text-[11px] font-bold"
          style={{ color, background: `${STATUS_COLOR[status] ?? '#fff'}22` }}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${active ? 'animate-pulse' : ''}`}
            style={{ background: color }}
          />
          {t(`downloads.st.${status}` as MessageKey)}
        </span>
        <div className="mt-1 text-[10.5px] font-medium text-white/35">{dl.clientName}</div>
      </div>

      <div className="flex justify-end gap-1.5">
        {pausable ? (
          <ActionBtn title={t('downloads.pause')} onClick={onPause} disabled={busy}>
            <IconPlayerPause size={13} stroke={2.2} />
          </ActionBtn>
        ) : null}
        {resumable ? (
          <ActionBtn title={t('downloads.resume')} onClick={onResume} disabled={busy}>
            <IconPlayerPlay size={13} stroke={2.2} />
          </ActionBtn>
        ) : null}
        {retryable ? (
          <ActionBtn title={t('downloads.retry')} onClick={onRetry} disabled={busy}>
            <IconRefresh size={13} stroke={2.2} />
          </ActionBtn>
        ) : null}
        <ActionBtn title={t('downloads.remove')} onClick={onRemove} disabled={busy} danger>
          <IconTrash size={13} stroke={2} />
        </ActionBtn>
      </div>
    </div>
  );
}

function ActionBtn({
  title,
  onClick,
  disabled,
  danger,
  children,
}: Readonly<{
  title: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-50 ${danger ? 'border-white/12 bg-[#1A1A20] text-white/55 hover:text-[#E8536A]' : 'border-white/12 bg-[#1A1A20] text-white/70 hover:text-white'}`}
    >
      {children}
    </button>
  );
}
