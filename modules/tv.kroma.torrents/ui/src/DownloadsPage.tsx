// Admin "Téléchargements": one page of the download queue (progress fed by a
// page-scoped download.progress stream, slow poll as the safety net), a VPN
// status banner, the throughput cards above it and the download-clients section
// below.

import {
  Denied,
  ModuleFailed,
  ModuleLoading,
  useCap,
  usePoll,
  useServerEvents,
  useT,
} from '@kroma/module-sdk';
import type { VpnStatusEvent } from '@kroma/module-vpn/schemas';
import {
  Box,
  Button,
  Callout,
  Dialog,
  EmptyState,
  IconButton,
  PageHeader,
  Pagination,
  Row,
  Surface,
  Text,
} from '@kroma/ui/kit';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTorrentsApi } from './api';
import { ContentsModal } from './contents-modal';
import { DownloadClientsSection } from './download-clients';
import { DownloadRowView, DownloadTableHead, type LiveDl } from './download-row';
import { DownloadFilters } from './downloads-filters';
import { DownloadStats } from './downloads-stats';
import { LimitsModal } from './limits-modal';
import { LinkModal } from './link-modal';
import { ManualGrabModal } from './manual-grab';
import type {
  DownloadCompletedEvent,
  DownloadProgressEvent,
  DownloadQuery,
  DownloadView,
} from './schemas';

const WIPE_ROW: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  cursor: 'pointer',
};

const WIPE_BOX: CSSProperties = { width: 16, height: 16, accentColor: 'var(--kroma-danger)' };

const POLL_MS = 10000;
const RELOAD_THROTTLE_MS = 1500;
// Long enough that a word is one request, short enough to feel like filtering.
const SEARCH_SETTLE_MS = 350;

/** The Downloads module page (`/admin/downloads`): the live download queue,
 *  VPN status banner, aggregate stats, and the download-clients section. Default
 *  export so the module runtime can `React.lazy` it into its own chunk. */
export default function DownloadsPage() {
  const t = useT();
  const torrents = useTorrentsApi();
  const canSettings = useCap('settings.manage');
  const canQueue = useCap('requests.manage') || canSettings;

  const [live, setLive] = useState<Record<string, LiveDl>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<DownloadView | null>(null);
  const [wipeData, setWipeData] = useState(true);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState<DownloadQuery>({ page: 1 });
  // What is in the search box, which is NOT what is being asked for: a keystroke
  // is not a query. It settles into `query` after a pause, so typing costs one
  // request rather than one per letter.
  const [typed, setTyped] = useState('');
  useEffect(() => {
    const at = setTimeout(
      () => setQuery((q) => (q.q === (typed || undefined) ? q : { ...q, q: typed, page: 1 })),
      SEARCH_SETTLE_MS,
    );
    return () => clearTimeout(at);
  }, [typed]);

  // The query is part of the key, so changing a filter refetches rather than
  // re-slicing a page that was already narrowed by the server.
  const queryKey = useMemo(() => ['admin', 'downloads', query] as const, [query]);
  const { data, failed, reload } = usePoll(queryKey, () => torrents.downloads(query), POLL_MS);
  // A new key starts empty. Rendering the previous answer while the next one is
  // in flight is what keeps the filter bar (and the caret in it) on screen.
  const shownRef = useRef(data);
  if (data) shownRef.current = data;
  const shown = data ?? shownRef.current;
  const clientsPoll = usePoll(['admin', 'downloads', 'clients'], () => torrents.clients(), 60000);

  const lastReloadRef = useRef(0);
  const throttledReload = useCallback(() => {
    const now = Date.now();
    if (now - lastReloadRef.current < RELOAD_THROTTLE_MS) return;
    lastReloadRef.current = now;
    reload();
  }, [reload]);

  // `download.progress` frames feed the per-row overlay; terminal events
  // trigger a throttled reload (safety net beside the slow poll).
  useServerEvents<DownloadProgressEvent | DownloadCompletedEvent | VpnStatusEvent>((e) => {
    if (e.type === 'download.progress') {
      setLive((s) => ({
        ...s,
        [e.id]: {
          progress: e.progress,
          downBps: e.downBps,
          upBps: e.upBps,
          peers: e.peers,
          peersSeen: e.peersSeen,
          state: e.state,
        },
      }));
    } else if (
      e.type === 'download.completed' ||
      e.type === 'request.updated' ||
      e.type === 'vpn.status'
    ) {
      throttledReload();
    }
  });

  const act = (fn: () => Promise<unknown>) => {
    setBusy(true);
    fn()
      .catch(() => undefined)
      .finally(() => {
        setBusy(false);
        reload();
      });
  };

  const relink = async (dl: DownloadView) => {
    if (await LinkModal.call({ dl })) reload();
  };

  const editLimits = async () => {
    if (await LimitsModal.call()) reload();
  };

  if (!canQueue) return <Denied />;
  if (!shown) return failed ? <ModuleFailed retry={reload} /> : <ModuleLoading />;

  const { downloads, page, stats, vpn } = shown;
  const hasActive = stats.active > 0;

  return (
    <>
      <PageChrome
        onManual={() => setManual(true)}
        onSettings={canSettings ? editLimits : undefined}
      />

      {vpn ? <VpnBanner vpn={vpn} /> : null}

      <DownloadStats stats={stats} />

      <DownloadFilters
        query={query}
        onQueryChange={setQuery}
        search={typed}
        onSearchChange={setTyped}
        stats={stats}
        clients={clientsPoll.data?.clients ?? []}
      />

      {hasActive ? (
        <Row wrap gap={8} mb={12}>
          <Button
            variant="glass"
            size="sm"
            icon="player-pause"
            label={t('downloads.pauseAll')}
            onPress={() => act(() => torrents.pauseAll())}
            disabled={busy}
          />
          <Button
            variant="glass"
            size="sm"
            icon="player-play"
            label={t('downloads.resumeAll')}
            onPress={() => act(() => torrents.resumeAll())}
            disabled={busy}
          />
          <Button
            variant="glass"
            size="sm"
            icon="users-plus"
            label={t('downloads.askPeers')}
            onPress={() => act(() => torrents.reannounceAll())}
            disabled={busy}
          />
        </Row>
      ) : null}

      <Surface elevated pad="none" radius="2xl" border="border" overflow="hidden">
        <DownloadTableHead />
        {downloads.map((dl) => (
          <DownloadRowView
            key={dl.id}
            dl={dl}
            live={live[dl.id]}
            busy={busy}
            onPause={() => act(() => torrents.pause(dl.id))}
            onResume={() => act(() => torrents.resume(dl.id))}
            onRetry={() => act(() => torrents.retry(dl.id))}
            onAskPeers={() => act(() => torrents.reannounce(dl.id))}
            onRelink={() => relink(dl)}
            onContents={() => void ContentsModal.call({ dl })}
            onRemove={() => {
              setWipeData(true);
              setConfirm(dl);
            }}
          />
        ))}
        {downloads.length === 0 ? (
          <Box py={24}>
            <EmptyState.Root icon="download">
              <EmptyState.Title>{t('downloads.empty')}</EmptyState.Title>
            </EmptyState.Root>
          </Box>
        ) : null}
      </Surface>

      {page.pageCount > 1 ? (
        <Row between wrap gap={12} mt={16}>
          <Text variant="meta" color="text/40">
            {t('downloads.pageOf', {
              first: String((page.page - 1) * page.perPage + 1),
              last: String(Math.min(page.page * page.perPage, page.total)),
              total: String(page.total),
            })}
          </Text>
          <Pagination.Root
            page={page.page}
            pageCount={page.pageCount}
            onPageChange={(next) => setQuery((q) => ({ ...q, page: next }))}
            label={t('admin.downloadsTitle')}
            size="sm"
          />
        </Row>
      ) : null}

      {canSettings ? <DownloadClientsSection /> : null}

      {confirm ? (
        <Dialog.Root
          open
          title={t('downloads.removeTitle')}
          onClose={() => setConfirm(null)}
          width="sm"
        >
          <Text variant="meta" color="text/70">
            {t('downloads.removeBody', { title: confirm.title })}
          </Text>
          <label style={WIPE_ROW}>
            <input
              type="checkbox"
              checked={wipeData}
              onChange={(e) => setWipeData(e.target.checked)}
              style={WIPE_BOX}
            />
            <Text variant="label" color="text/80">
              {t('downloads.removeData')}
            </Text>
          </label>
          <Dialog.Actions
            onCancel={() => setConfirm(null)}
            cancelLabel={t('common.cancel')}
            onConfirm={() => {
              const dl = confirm;
              setConfirm(null);
              act(() => torrents.remove(dl.id, { deleteData: wipeData }));
            }}
            confirmLabel={t('downloads.removeConfirm')}
            busy={busy}
          />
        </Dialog.Root>
      ) : null}

      {manual ? <ManualGrabModal onClose={() => setManual(false)} onAdded={reload} /> : null}
      <ContentsModal.Root />
      <LinkModal.Root />
      <LimitsModal.Root />
    </>
  );
}

function PageChrome({
  onManual,
  onSettings,
}: Readonly<{ onManual: () => void; onSettings?: () => void }>) {
  const t = useT();
  return (
    <>
      <PageHeader.Root>
        <PageHeader.Title>{t('admin.downloadsTitle')}</PageHeader.Title>
        <PageHeader.Subtitle>{t('admin.downloadsSub')}</PageHeader.Subtitle>
        <PageHeader.Actions>
          {onSettings ? (
            <IconButton icon="settings" label={t('downloads.settings')} onPress={onSettings} />
          ) : null}
          <Button variant="primary" icon="plus" label={t('manual.title')} onPress={onManual} />
        </PageHeader.Actions>
      </PageHeader.Root>
      {/* spacer to match the standard PageHeader → content rhythm */}
      <Box h={24} />
    </>
  );
}

function VpnBanner({
  vpn,
}: Readonly<{ vpn: { connected: boolean; exitIp: string | null; paused: boolean } }>) {
  const t = useT();
  let message: string;
  if (vpn.connected) message = t('downloads.vpnOk', { ip: vpn.exitIp ?? '?' });
  else if (vpn.paused) message = t('downloads.vpnBlocked');
  else message = t('downloads.vpnDown');
  return (
    <Box mb={16}>
      <Callout.Root
        size="sm"
        tone={vpn.connected ? 'success' : 'accent'}
        icon={vpn.connected ? 'shield-check' : 'shield-x'}
      >
        <Callout.Title>{message}</Callout.Title>
      </Callout.Root>
    </Box>
  );
}
