import type { MessageKey, PlayEntry } from '@kroma/core';
import { TABULAR } from '@kroma/module-sdk';
import { useFormat, useT } from '@kroma/ui';
import { Box, EmptyState, type SortColumn, Table, Text } from '@kroma/ui/kit';
import type { ComponentType } from 'react';
import {
  type HistoryColumn,
  type HistorySort,
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
      {play.player ?? ABSENT}
    </Text>
  );
}

function PlatformCell({ play }: Readonly<{ play: PlayEntry }>) {
  return (
    <Text variant="meta" color="textDim" lines={1}>
      {play.device ?? ABSENT}
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
  player: PlayerCell,
  device: PlatformCell,
  endedAt: WhenCell,
};

function HistoryRow({
  play,
  columns,
}: Readonly<{ play: PlayEntry; columns: readonly HistoryColumn[] }>) {
  return (
    <Table.Row>
      {columns.map((column) => {
        const Cell = CELLS[column.column];
        return (
          <Table.Cell key={column.column}>
            <Cell play={play} />
          </Table.Cell>
        );
      })}
    </Table.Row>
  );
}

interface HistoryTableProps {
  columns: readonly HistoryColumn[];
  plays: readonly PlayEntry[];
  sort: readonly SortColumn[];
  onSortChange: (next: readonly SortColumn[]) => void;
  emptyKey: MessageKey;
  loaded: boolean;
}

export function HistoryTable({
  columns,
  plays,
  sort,
  onSortChange,
  emptyKey,
  loaded,
}: Readonly<HistoryTableProps>) {
  const t = useT();
  if (loaded && plays.length === 0) {
    return (
      <EmptyState.Root icon="history">
        <EmptyState.Title>{t(emptyKey)}</EmptyState.Title>
      </EmptyState.Root>
    );
  }
  return (
    <Table.Root
      label={t('admin.historyScreen')}
      columns={columns}
      required
      sort={sort}
      onSortChange={onSortChange}
    >
      <Table.Header>
        <Table.Row>
          {columns.map((column) => (
            <Table.Cell key={column.column}>{t(column.labelKey)}</Table.Cell>
          ))}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {plays.map((play) => (
          <HistoryRow key={play.id} play={play} columns={columns} />
        ))}
      </Table.Body>
    </Table.Root>
  );
}
