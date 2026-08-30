import { resolveImageUrl, type TopUser } from '@kroma/core';
import { TABULAR } from '@kroma/module-sdk';
import { useFormat, useT } from '@kroma/ui';
import {
  Avatar,
  Box,
  color,
  Divider,
  EmptyState,
  Grid,
  Pagination,
  Row,
  Section,
  Surface,
  Text,
} from '@kroma/ui/kit';
import { useState } from 'react';
import { KIND_SERIES } from '#web/features/admin/chart-palette';
import {
  daysOf,
  FilterSelect,
  kindLabelKey,
  useChoice,
  useRangeOptions,
  WATCH_KINDS,
  WATCH_RANGES,
} from '#web/features/admin/dashboard-filters';
import { dominantKind, kindTotals } from '#web/features/admin/dashboard-kind-totals';
import { PillDot } from '#web/features/admin/pill';
import { usePoll } from '#web/features/admin/shell';
import { apiBase } from '#web/shared/lib/api';
import { useAuth } from '#web/shared/lib/auth';

const CARDS_PER_PAGE = 6;
const POLL_MS = 30000;

const ROW_RULE = { borderBottomWidth: 1, borderBottomColor: color('tint/4') } as const;

export function TopViewersSection() {
  const t = useT();
  const { client } = useAuth();
  const range = useChoice(useRangeOptions(WATCH_RANGES), '7d');
  const [page, setPage] = useState(1);
  const { data } = usePoll(
    ['admin', 'topUsers', range.value],
    () => client.topUsers(daysOf(range.value)),
    POLL_MS,
  );

  const users = data?.users ?? [];
  const pageCount = Math.max(1, Math.ceil(users.length / CARDS_PER_PAGE));
  const at = Math.min(page, pageCount);
  const shown = users.slice((at - 1) * CARDS_PER_PAGE, at * CARDS_PER_PAGE);

  return (
    <Section.Root mt={28}>
      <Section.Header>
        <Section.Title>{t('admin.topUsers')}</Section.Title>
        <Section.Actions>
          <FilterSelect label={t('admin.topUsers')} choice={range} />
        </Section.Actions>
      </Section.Header>
      {users.length > 0 ? (
        <Grid min={220} gap={16}>
          {shown.map((user) => (
            <TopViewerCard key={user.userId ?? user.username} user={user} />
          ))}
        </Grid>
      ) : null}
      {pageCount > 1 ? (
        <Row justify="flex-end" mt={16}>
          <Pagination.Root
            page={at}
            pageCount={pageCount}
            onPageChange={setPage}
            label={t('admin.topUsers')}
          />
        </Row>
      ) : null}
      {data && users.length === 0 ? (
        <EmptyState.Root size="sm" icon="users">
          <EmptyState.Title>{t('admin.topUsersEmpty')}</EmptyState.Title>
        </EmptyState.Root>
      ) : null}
    </Section.Root>
  );
}

function TopViewerCard({ user }: Readonly<{ user: TopUser }>) {
  const t = useT();
  const fmt = useFormat();
  const totals = kindTotals(user.byKind, user.filmsMs, user.tvMs);
  const dominant = dominantKind(totals);
  return (
    <Surface elevated pad="none" radius="xl" border="border" overflow="hidden">
      <Row gap={14} px={20} py={18}>
        <Avatar
          name={user.username}
          src={resolveImageUrl(apiBase(), user.avatarUrl)}
          size={48}
          circle
        />
        <Box>
          <Text variant="title">{t('admin.plays', { count: user.plays })}</Text>
          <Text variant="meta" color="textMuted">
            {fmt.duration(user.watchedMs)}
          </Text>
        </Box>
      </Row>
      <Divider color="tint/5" />
      <Box bg="surface2" px={20} py={11}>
        <Text variant="label">{user.username}</Text>
      </Box>
      <Divider color="tint/5" />
      <Box>
        {WATCH_KINDS.map((kind) => {
          const on = kind === dominant;
          return (
            <Row
              key={kind}
              between
              px={20}
              py={11}
              bg={on ? 'accentWash/16' : 'transparent'}
              style={ROW_RULE}
            >
              <Row gap={8}>
                <PillDot tone={KIND_SERIES[kind]} size={7} />
                <Text variant="meta" color={on ? 'accentText' : 'textMuted'}>
                  {t(kindLabelKey(kind))}
                </Text>
              </Row>
              <Text variant="meta" color={on ? 'accentText' : 'textMuted'} style={TABULAR}>
                {fmt.duration(totals[kind])}
              </Text>
            </Row>
          );
        })}
      </Box>
    </Surface>
  );
}
