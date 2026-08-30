// Who watched what, when, and on what. The top-user cards say how much each
// member watched; this says which titles, from which device, and whether the
// server had to re-encode to get them there.

import type { PlayEntry } from '@kroma/core';
import { TABULAR, Table } from '@kroma/module-sdk';
import { useFormat, useT } from '@kroma/ui';
import {
  Box,
  Button,
  type ColorValue,
  EmptyState,
  Row,
  Section,
  Select,
  Text,
} from '@kroma/ui/kit';
import { useState } from 'react';
import { Pill } from '#web/features/admin/pill';
import { usePoll } from '#web/features/admin/shell';
import { useAuth } from '#web/shared/lib/auth';

const PAGE = 25;

type Tone = { ink: ColorValue; bg: ColorValue };

const DIRECT: Tone = { ink: 'success', bg: 'success/14' };
const TRANSCODE: Tone = { ink: 'accent', bg: 'accentWash/16' };
const REMUX: Tone = { ink: 'info', bg: 'info/14' };

function modeTone(mode: string | null | undefined): Tone {
  if (mode === 'transcode') return TRANSCODE;
  return mode === 'remux' ? REMUX : DIRECT;
}

function what(p: PlayEntry) {
  if (!p.showTitle) return p.title;
  return p.season == null ? p.showTitle : `${p.showTitle} · S${p.season}E${p.episode ?? '?'}`;
}

export function WatchLogSection({
  users,
}: Readonly<{ users: { id: string; username: string }[] }>) {
  const t = useT();
  const fmt = useFormat();
  const { client } = useAuth();
  const [days, setDays] = useState(30);
  const [who, setWho] = useState('');
  const [page, setPage] = useState(0);

  const { data } = usePoll(
    ['admin', 'plays', days, who, page],
    () => client.adminPlays({ days, user: who || undefined, limit: PAGE, offset: page * PAGE }),
    60000,
  );
  const plays = data?.plays ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));

  const move = (to: number) => setPage(Math.max(0, Math.min(pages - 1, to)));
  const reset = (apply: () => void) => {
    apply();
    setPage(0);
  };

  return (
    <Section.Root mt={28}>
      <Section.Header>
        <Section.Title>{t('admin.watchLog')}</Section.Title>
        <Section.Actions>
          <Row gap={10}>
            <Select.Root
              label={t('admin.colUser')}
              value={who}
              onValueChange={(v) => reset(() => setWho(v))}
            >
              <Select.Trigger />
              <Select.Item value="" label={t('admin.everyMember')} />
              {users.map((u) => (
                <Select.Item key={u.id} value={u.id} label={u.username} />
              ))}
            </Select.Root>
            <Select.Root
              label={t('admin.watchLog')}
              value={String(days)}
              onValueChange={(v) => reset(() => setDays(Number(v)))}
            >
              <Select.Trigger />
              {[7, 30, 90, 365].map((d) => (
                <Select.Item key={d} value={String(d)} label={t('admin.lastNdays', { count: d })} />
              ))}
            </Select.Root>
          </Row>
        </Section.Actions>
      </Section.Header>

      <Table.Root columns="1.1fr 2fr 1.4fr 1fr 0.9fr 0.9fr">
        <Table.Header>
          <Table.Column>{t('admin.colUser')}</Table.Column>
          <Table.Column>{t('admin.colTitle')}</Table.Column>
          <Table.Column wide>{t('admin.colDevice')}</Table.Column>
          <Table.Column wide>{t('admin.colPlayback')}</Table.Column>
          <Table.Column wide>{t('admin.colWatched')}</Table.Column>
          <Table.Column wide>{t('admin.colWhen')}</Table.Column>
        </Table.Header>
        {plays.map((p) => {
          const tone = modeTone(p.mode);
          return (
            <Table.Row key={p.id}>
              <Table.Cell>
                <Text variant="label" lines={1}>
                  {p.username}
                </Text>
              </Table.Cell>
              <Table.Cell>
                <Box minW={0}>
                  <Text variant="meta" lines={1}>
                    {what(p)}
                  </Text>
                  {p.videoLabel ? (
                    <Text variant="meta" color="textDim" lines={1}>
                      {[p.videoLabel, p.audioLabel].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </Box>
              </Table.Cell>
              <Table.Cell wide>
                <Box minW={0}>
                  <Text variant="meta" color="textMuted" lines={1}>
                    {p.device ?? '-'}
                  </Text>
                  <Text variant="meta" color="textDim" lines={1}>
                    {[p.player, p.network].filter(Boolean).join(' · ')}
                  </Text>
                </Box>
              </Table.Cell>
              <Table.Cell wide>
                <Pill ink={tone.ink} bg={tone.bg}>
                  {p.mode ?? t('admin.directPlay')}
                </Pill>
              </Table.Cell>
              <Table.Cell wide>
                <Text variant="meta" color="textMuted" style={TABULAR}>
                  {fmt.duration(p.watchedMs)}
                </Text>
              </Table.Cell>
              <Table.Cell wide>
                <Text variant="meta" color="textDim">
                  {fmt.elapsed(p.endedAt * 1000)}
                </Text>
              </Table.Cell>
            </Table.Row>
          );
        })}
        {data && plays.length === 0 ? (
          <EmptyState.Root icon="history">
            <EmptyState.Title>{t('admin.noHistory')}</EmptyState.Title>
          </EmptyState.Root>
        ) : null}
      </Table.Root>

      {pages > 1 ? (
        <Row between mt={14}>
          <Text variant="meta" color="textDim">
            {t('admin.watchLogCount', { count: total })}
          </Text>
          <Row gap={10}>
            <Button variant="ghost" disabled={page === 0} onPress={() => move(page - 1)}>
              {t('common.previous')}
            </Button>
            <Text variant="meta" color="textMuted" style={TABULAR}>
              {page + 1} / {pages}
            </Text>
            <Button variant="ghost" disabled={page >= pages - 1} onPress={() => move(page + 1)}>
              {t('common.next')}
            </Button>
          </Row>
        </Row>
      ) : null}
    </Section.Root>
  );
}
