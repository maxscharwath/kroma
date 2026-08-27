import { useT } from '@kroma/module-sdk';
import { type ColorValue, Menu, Row, Text, useBreakpoint } from '@kroma/ui/kit';
import { useNavigate } from '@tanstack/react-router';
import type { CSSProperties, ReactNode } from 'react';
import { RowProgressCell, RowSpeedCell, RowStatusCell, RowTitleCell } from './download-cells';
import type { DownloadView } from './schemas';

/** Live per-download overlay fed by `download.progress` WS frames. */
export interface LiveDl {
  progress: number;
  downBps: number;
  upBps: number;
  peers: number;
  peersSeen: number;
  state: string;
}

const STATUS_TONE: Record<string, ColorValue> = {
  queued: 'text/55',
  downloading: 'accent',
  seeding: 'success',
  completed: 'success',
  imported: 'success',
  paused: 'text/55',
  failed: 'danger',
  removed: 'text/40',
};

const WIDE_COLUMNS = 'minmax(0, 1fr) 208px 136px 132px 48px';
const NARROW_COLUMNS = 'minmax(0, 1fr) auto';

const TABLE_CELLS: CSSProperties = {
  display: 'grid',
  alignItems: 'center',
  gap: 16,
  padding: '12px 20px',
};

const TABLE_HEAD: CSSProperties = {
  ...TABLE_CELLS,
  background: 'var(--kroma-surface-1)',
  borderBottom: '1px solid color-mix(in srgb, var(--kroma-tint) 6%, transparent)',
};

const TABLE_ROW: CSSProperties = {
  ...TABLE_CELLS,
  borderBottom: '1px solid color-mix(in srgb, var(--kroma-tint) 4%, transparent)',
};

const TABLE_HEAD_WIDE: CSSProperties = { ...TABLE_HEAD, gridTemplateColumns: WIDE_COLUMNS };
const TABLE_HEAD_NARROW: CSSProperties = { ...TABLE_HEAD, gridTemplateColumns: NARROW_COLUMNS };
const TABLE_ROW_WIDE: CSSProperties = { ...TABLE_ROW, gridTemplateColumns: WIDE_COLUMNS };
const TABLE_ROW_NARROW: CSSProperties = { ...TABLE_ROW, gridTemplateColumns: NARROW_COLUMNS };

/** The heading band of the download table. It shares its column template with
 *  <DownloadRowView>, which is why the two live together. */
export function DownloadTableHead() {
  const t = useT();
  const wide = useBreakpoint() !== 'base';
  return (
    <div style={wide ? TABLE_HEAD_WIDE : TABLE_HEAD_NARROW}>
      <HeadCell>{t('downloads.colRelease')}</HeadCell>
      {wide ? <HeadCell>{t('downloads.colProgress')}</HeadCell> : null}
      {wide ? <HeadCell>{t('downloads.colSpeed')}</HeadCell> : null}
      {wide ? <HeadCell>{t('downloads.colStatus')}</HeadCell> : null}
      <span />
    </div>
  );
}

function HeadCell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Text variant="overline" color="textDim">
      {children}
    </Text>
  );
}

export function DownloadRowView({
  dl,
  live,
  busy,
  onPause,
  onResume,
  onRetry,
  onAskPeers,
  onRelink,
  onRemove,
  showClient = false,
}: Readonly<{
  dl: DownloadView;
  live?: LiveDl;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onAskPeers: () => void;
  onRelink: () => void;
  onRemove: () => void;
  /** Name the engine on each row. Off with a single engine, where it is the
   *  same word all the way down. */
  showClient?: boolean;
}>) {
  const wide = useBreakpoint() !== 'base';
  const status = live?.state && dl.status !== 'imported' ? live.state : dl.status;
  const progress = live?.progress ?? dl.progress;
  // Fall back to the polled row so speed + peers still show when the WebSocket
  // can't reach the client, e.g. through a tunnel.
  const stat = live ?? {
    downBps: dl.downBps,
    upBps: dl.upBps,
    peers: dl.peers,
    peersSeen: dl.peersSeen,
  };
  const tone = STATUS_TONE[status] ?? 'text/55';
  const active = status === 'downloading' || status === 'queued' || status === 'seeding';

  return (
    <div style={wide ? TABLE_ROW_WIDE : TABLE_ROW_NARROW}>
      <RowTitleCell dl={dl} />
      {wide ? <RowProgressCell dl={dl} progress={progress} tone={tone} /> : null}
      {wide ? <RowSpeedCell dl={dl} active={active} stat={stat} /> : null}
      {wide ? (
        <RowStatusCell
          dl={dl}
          status={status}
          tone={tone}
          active={active}
          showClient={showClient}
        />
      ) : null}
      <RowActionsMenu
        dl={dl}
        status={status}
        active={active}
        busy={busy}
        onPause={onPause}
        onResume={onResume}
        onRetry={onRetry}
        onAskPeers={onAskPeers}
        onRelink={onRelink}
        onRemove={onRemove}
      />
    </div>
  );
}

function useOpenInKroma(dl: DownloadView): (() => void) | null {
  const navigate = useNavigate();
  const localId = dl.localId;
  if (!localId) return null;
  return () =>
    navigate({
      to: dl.kind === 'movie' ? '/movies/$id' : '/shows/$id',
      params: { id: localId },
    });
}

function openTrackerPage(url: string | null | undefined): (() => void) | null {
  if (!url) return null;
  return () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };
}

function RowActionsMenu({
  dl,
  status,
  active,
  busy,
  onPause,
  onResume,
  onRetry,
  onAskPeers,
  onRelink,
  onRemove,
}: Readonly<{
  dl: DownloadView;
  status: string;
  active: boolean;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onAskPeers: () => void;
  onRelink: () => void;
  onRemove: () => void;
}>) {
  const t = useT();
  const pausable = active;
  const resumable = status === 'paused';
  // Only meaningful while the torrent is live in the engine.
  const canAskPeers = active || status === 'seeding';
  const openInKroma = useOpenInKroma(dl);
  const openTracker = openTrackerPage(dl.detailsUrl);

  return (
    <Row justify="flex-end">
      <Menu.Root label={t('downloads.rowActions')} align="end">
        <Menu.Trigger />
        {pausable ? (
          <Menu.Item
            icon="player-pause"
            label={t('downloads.pause')}
            onSelect={onPause}
            disabled={busy}
          />
        ) : null}
        {resumable ? (
          <Menu.Item
            icon="player-play"
            label={t('downloads.resume')}
            onSelect={onResume}
            disabled={busy}
          />
        ) : null}
        {canAskPeers ? (
          <Menu.Item
            icon="users-plus"
            label={t('downloads.askPeers')}
            onSelect={onAskPeers}
            disabled={busy}
          />
        ) : null}
        {/* Offered in every state: the backend re-imports a completed download
            and resets + re-adds anything else. */}
        <Menu.Item icon="refresh" label={t('downloads.retry')} onSelect={onRetry} disabled={busy} />
        <Menu.Item icon="link" label={t('downloads.relink')} onSelect={onRelink} disabled={busy} />
        {openInKroma ? (
          <Menu.Item icon="info-circle" label={t('downloads.openInKroma')} onSelect={openInKroma} />
        ) : null}
        {openTracker ? (
          <Menu.Item
            icon="external-link"
            label={t('downloads.viewOnTracker')}
            onSelect={openTracker}
          />
        ) : null}
        <Menu.Separator />
        <Menu.Item
          icon="trash"
          label={t('downloads.remove')}
          onSelect={onRemove}
          disabled={busy}
          tone="danger"
        />
      </Menu.Root>
    </Row>
  );
}
