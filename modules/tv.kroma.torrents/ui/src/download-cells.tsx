// The cells of one download row.
//
// The title cell HUGS its content rather than filling the track: a badge that
// belongs to a title has to sit beside it, and a release name stretched across
// the column leaves its indexer marooned in the middle of the row. Everything
// that can overflow is `shrink minW={0}`, which is what makes a react-native-web
// `<Text lines={1}>` actually ellipsize (a View there does not shrink by
// default, so `max-width: 100%` never bites).

import { type MessageKey, useFormat, useT } from '@kroma/module-sdk';
import {
  Badge,
  Box,
  type ColorValue,
  color,
  Icon,
  Img,
  Progress,
  Row,
  styles,
  Text,
  Tooltip,
} from '@kroma/ui/kit';
import type { CSSProperties } from 'react';
import type { DownloadView } from './schemas';

const POSTER_WIDTH = 34;
const POSTER_HEIGHT = 50;

const STATUS_DOT: CSSProperties = { width: 6, height: 6, borderRadius: '50%', flex: '0 0 auto' };
const BREATHE = 'kroma-breathe 2s ease-in-out infinite';
const TRACKER_LINK: CSSProperties = { display: 'inline-flex', flex: '0 0 auto' };

const s = styles({
  tabular: { fontVariant: ['tabular-nums'] },
});

/** The season/episode this grab is for, or nothing for a film. */
function targetPill(dl: DownloadView): string | null {
  const season = String(dl.season ?? 0).padStart(2, '0');
  if (dl.kind === 'season') return `S${season}`;
  if (dl.kind === 'episode') {
    const first = dl.episodes?.[0] ?? 0;
    const last = dl.episodes?.[dl.episodes.length - 1] ?? first;
    const from = `S${season}E${String(first).padStart(2, '0')}`;
    // A pack of episodes is one torrent; saying only its first episode reads as
    // a single-episode grab.
    return last > first ? `${from}-E${String(last).padStart(2, '0')}` : from;
  }
  return null;
}

export function RowTitleCell({ dl }: Readonly<{ dl: DownloadView }>) {
  const t = useT();
  const target = targetPill(dl);
  return (
    <Row gap={12} minW={0}>
      <Box
        w={POSTER_WIDTH}
        h={POSTER_HEIGHT}
        shrink={0}
        center
        radius={4}
        overflow="hidden"
        bg="tint/5"
      >
        {dl.posterUrl ? (
          <Img src={dl.posterUrl} fill />
        ) : (
          <Icon name="movie" size={14} color="glyphDim" />
        )}
      </Box>
      <Box shrink={1} minW={0} gap={3}>
        <Row gap={8} minW={0}>
          <Text variant="label" lines={1} shrink={1} minW={0}>
            {dl.title}
          </Text>
          {target ? <Badge tone="info">{target}</Badge> : null}
          {dl.tmdbId === 0 ? <Badge tone="warning">{t('downloads.unlinked')}</Badge> : null}
        </Row>
        <Row gap={6} minW={0}>
          <Text variant="meta" color="text/40" lines={1} shrink={1} minW={0}>
            {dl.releaseTitle}
          </Text>
          {dl.indexerName ? (
            <Text variant="meta" color="text/30" shrink={0}>
              · {dl.indexerName}
            </Text>
          ) : null}
          {dl.detailsUrl ? (
            <a
              href={dl.detailsUrl}
              target="_blank"
              rel="noreferrer"
              title={t('downloads.viewOnTracker')}
              style={TRACKER_LINK}
            >
              <Icon name="external-link" size={12} thickness={2} color="glyph" />
            </a>
          ) : null}
        </Row>
        {dl.error ? (
          <Text variant="meta" color="dangerHover" lines={1}>
            {dl.error}
          </Text>
        ) : null}
      </Box>
    </Row>
  );
}

export function RowProgressCell({
  dl,
  progress,
  tone,
}: Readonly<{ dl: DownloadView; progress: number; tone: ColorValue }>) {
  const fmt = useFormat();
  // What is on disk so far, which is the number an operator is watching; the
  // total is what it is heading for.
  const done = dl.sizeBytes != null ? fmt.bytes(dl.sizeBytes * progress) : null;
  return (
    <Box gap={5}>
      <Progress value={progress} color={tone} thickness={5} rounded />
      <Row between gap={8} minW={0}>
        <Text variant="meta" color="text/55" style={s.tabular}>
          {`${Math.round(progress * 100)}%`}
        </Text>
        {dl.sizeBytes != null ? (
          <Text variant="meta" color="text/35" lines={1} style={s.tabular}>
            {done ? `${done} / ${fmt.bytes(dl.sizeBytes)}` : fmt.bytes(dl.sizeBytes)}
          </Text>
        ) : null}
      </Row>
    </Box>
  );
}

interface LiveStat {
  downBps: number;
  upBps: number;
  peers: number;
  peersSeen: number;
}

export function RowSpeedCell({
  dl,
  active,
  stat,
}: Readonly<{ dl: DownloadView; active: boolean; stat: LiveStat }>) {
  const t = useT();
  const fmt = useFormat();
  // A finished torrent still has something to say: what it gave back.
  if (!active) {
    return dl.uploadedBytes > 0 ? (
      <Box gap={3}>
        <Rate icon="arrow-up" tone="text/45" value={fmt.bytes(dl.uploadedBytes)} />
        {dl.downloadedBytes > 0 ? (
          <Text variant="meta" color="text/30" style={s.tabular}>
            {t('downloads.ratioShort', {
              ratio: (dl.uploadedBytes / dl.downloadedBytes).toFixed(2),
            })}
          </Text>
        ) : null}
      </Box>
    ) : (
      <Text variant="meta" color="text/25">
        —
      </Text>
    );
  }
  const peerTone = stat.peers > 0 ? 'info' : 'accent';
  return (
    <Box gap={3}>
      <Rate icon="arrow-down" tone="success" value={`${fmt.bytes(stat.downBps)}/s`} />
      <Row gap={8} minW={0}>
        <Rate icon="arrow-up" tone="text/40" value={`${fmt.bytes(stat.upBps)}/s`} />
        <Tooltip
          label={t('downloads.peersDetail', {
            live: String(stat.peers),
            seen: String(stat.peersSeen),
          })}
        >
          <Row gap={2}>
            <Icon name="users" size={11} thickness={2} color={peerTone} />
            <Text variant="meta" color={peerTone} style={s.tabular}>
              {stat.peersSeen > stat.peers ? `${stat.peers}/${stat.peersSeen}` : stat.peers}
            </Text>
          </Row>
        </Tooltip>
      </Row>
    </Box>
  );
}

// One throughput figure behind its direction arrow, so up and down are told
// apart by shape and not by colour alone.
function Rate({
  icon,
  tone,
  value,
}: Readonly<{ icon: 'arrow-up' | 'arrow-down'; tone: ColorValue; value: string }>) {
  return (
    <Row gap={3} minW={0}>
      <Icon name={icon} size={11} thickness={2.4} color={tone} />
      <Text variant="meta" color={tone} lines={1} style={s.tabular}>
        {value}
      </Text>
    </Row>
  );
}

export function RowAddedCell({ dl }: Readonly<{ dl: DownloadView }>) {
  const fmt = useFormat();
  return (
    <Text variant="meta" color="text/45" lines={1} style={s.tabular}>
      {fmt.elapsed(dl.grabbedAt)}
    </Text>
  );
}

export function RowStatusCell({
  dl,
  status,
  tone,
  active,
  showClient,
}: Readonly<{
  dl: DownloadView;
  status: string;
  tone: ColorValue;
  active: boolean;
  /** Name the engine under the pill. Off when there is only one, where it is
   *  the same word on every row. */
  showClient: boolean;
}>) {
  const t = useT();
  const ink = color(tone);
  return (
    <Box gap={4}>
      <Row
        self="flex-start"
        gap={6}
        px={10}
        py={4}
        radius="pill"
        style={{ backgroundColor: `color-mix(in srgb, ${ink} 13%, transparent)` }}
      >
        <span style={{ ...STATUS_DOT, background: ink, animation: active ? BREATHE : undefined }} />
        <Text variant="meta" color={tone}>
          {t(`downloads.st.${status}` as MessageKey)}
        </Text>
      </Row>
      {showClient ? (
        <Text variant="meta" color="text/30" lines={1}>
          {dl.clientName}
        </Text>
      ) : null}
    </Box>
  );
}
