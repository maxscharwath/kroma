import type { MessageKey, PlayEntry } from '@kroma/core';
import { TABULAR, Table, type TableHeading } from '@kroma/module-sdk';
import { useFormat, useT } from '@kroma/ui';
import { Box, EmptyState, Text } from '@kroma/ui/kit';
import type { ComponentType } from 'react';
import {
  type HistoryColumn,
  type HistorySort,
  historyGrid,
  kindKey,
  titleLines,
} from '#web/features/admin/history-columns';

const ABSENT = '-';

function UserCell({ play }: Readonly<{ play: PlayEntry }>) {
  return (
    <Text variant="label" lines={1}>
      {play.username}
    </Text>
  );
}

function KindCell({ play }: Readonly<{ play: PlayEntry }>) {
  const t = useT();
  return (
    <Text variant="meta" color="textMuted" lines={1}>
      {t(kindKey(play.kind))}
    </Text>
  );
}

function TitleCell({ play }: Readonly<{ play: PlayEntry }>) {
  const { lead, detail } = titleLines(play);
  return (
    <Box minW={0}>
      <Text variant="meta" lines={1}>
        {lead}
      </Text>
      {detail ? (
        <Text variant="meta" color="textDim" lines={1}>
          {detail}
        </Text>
      ) : null}
    </Box>
  );
}

function PlayerCell({ play }: Readonly<{ play: PlayEntry }>) {
  return (
    <Text variant="meta" color="textMuted" lines={1}>
      {play.device ?? ABSENT}
    </Text>
  );
}

function PlatformCell({ play }: Readonly<{ play: PlayEntry }>) {
  return (
    <Text variant="meta" color="textDim" lines={1}>
      {play.player ?? ABSENT}
    </Text>
  );
}

function WhenCell({ play }: Readonly<{ play: PlayEntry }>) {
  const fmt = useFormat();
  return (
    <Text variant="meta" color="textDim" style={TABULAR}>
      {fmt.elapsed(play.endedAt * 1000)}
    </Text>
  );
}

const CELLS: Record<HistorySort, ComponentType<{ play: PlayEntry }>> = {
  username: UserCell,
  kind: KindCell,
  title: TitleCell,
  device: PlayerCell,
  player: PlatformCell,
  endedAt: WhenCell,
};

function HistoryRow({
  play,
  columns,
}: Readonly<{ play: PlayEntry; columns: readonly HistoryColumn[] }>) {
  return (
    <Table.Row>
      {columns.map((column) => {
        const Cell = CELLS[column.sortKey];
        return (
          <Table.Cell key={column.sortKey} wide={column.wide}>
            <Cell play={play} />
          </Table.Cell>
        );
      })}
    </Table.Row>
  );
}

interface HistoryTableProps {
  columns: readonly HistoryColumn[];
  headings: readonly TableHeading[];
  plays: readonly PlayEntry[];
  emptyKey: MessageKey;
  loaded: boolean;
}

export function HistoryTable({
  columns,
  headings,
  plays,
  emptyKey,
  loaded,
}: Readonly<HistoryTableProps>) {
  const t = useT();
  return (
    <Table.Root columns={historyGrid(columns)} label={t('admin.historyScreen')}>
      <Table.Header>
        {columns.map((column) => {
          const heading = headings.find((candidate) => candidate.id === column.sortKey);
          return (
            <Table.Column
              key={column.sortKey}
              wide={column.wide}
              sorted={heading?.sorted ?? false}
              onSortPress={heading?.onSortPress}
            >
              {t(column.labelKey)}
            </Table.Column>
          );
        })}
      </Table.Header>
      {plays.map((play) => (
        <HistoryRow key={play.id} play={play} columns={columns} />
      ))}
      {loaded && plays.length === 0 ? (
        <EmptyState.Root icon="history">
          <EmptyState.Title>{t(emptyKey)}</EmptyState.Title>
        </EmptyState.Root>
      ) : null}
    </Table.Root>
  );
}
