import type { MessageKey, PlayEntry } from '@kroma/core';
import { TABULAR } from '@kroma/module-sdk';
import { useFormat, useT } from '@kroma/ui';
import { Box, EmptyState, Focusable, type SortColumn, Table, Text } from '@kroma/ui/kit';
import type { ComponentType } from 'react';
import {
  type HistoryColumn,
  type HistorySort,
  kindKey,
  type TitleLines,
  titleLines,
} from '#web/features/admin/history-columns';
import { RouteLink } from '#web/shared/ui/route-link';

const ABSENT = '-';

type ShowIds = ReadonlyMap<string, string>;

interface CellProps {
  play: PlayEntry;
  showIds: ShowIds;
}

function UserCell({ play }: Readonly<CellProps>) {
  return (
    <Text variant="label" lines={1}>
      {play.username}
    </Text>
  );
}

function KindCell({ play }: Readonly<CellProps>) {
  const t = useT();
  return (
    <Text variant="meta" color="textMuted" lines={1}>
      {t(kindKey(play.kind))}
    </Text>
  );
}

function TitleFace({ lead, detail }: Readonly<TitleLines>) {
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

function TitleCell({ play, showIds }: Readonly<CellProps>) {
  const lines = titleLines(play);
  const face = <TitleFace {...lines} />;
  const show = play.showTitle ? showIds.get(play.showTitle) : undefined;
  if (!show) return face;
  return (
    <Focusable ring="focusInset" label={lines.lead} asChild>
      <RouteLink to="/shows/$id" params={{ id: show }}>
        {face}
      </RouteLink>
    </Focusable>
  );
}

function PlayerCell({ play }: Readonly<CellProps>) {
  return (
    <Text variant="meta" color="textMuted" lines={1}>
      {play.player ?? ABSENT}
    </Text>
  );
}

function PlatformCell({ play }: Readonly<CellProps>) {
  return (
    <Text variant="meta" color="textDim" lines={1}>
      {play.device ?? ABSENT}
    </Text>
  );
}

function WhenCell({ play }: Readonly<CellProps>) {
  const fmt = useFormat();
  return (
    <Text variant="meta" color="textDim" style={TABULAR}>
      {fmt.stamp(play.endedAt * 1000) ?? ABSENT}
    </Text>
  );
}

const CELLS: Record<HistorySort, ComponentType<CellProps>> = {
  username: UserCell,
  kind: KindCell,
  title: TitleCell,
  player: PlayerCell,
  device: PlatformCell,
  endedAt: WhenCell,
};

interface HistoryRowProps extends CellProps {
  columns: readonly HistoryColumn[];
}

function HistoryRow({ play, columns, showIds }: Readonly<HistoryRowProps>) {
  return (
    <Table.Row>
      {columns.map((column) => {
        const Cell = CELLS[column.column];
        return (
          <Table.Cell key={column.column}>
            <Cell play={play} showIds={showIds} />
          </Table.Cell>
        );
      })}
    </Table.Row>
  );
}

interface HistoryTableProps {
  columns: readonly HistoryColumn[];
  plays: readonly PlayEntry[];
  showIds: ShowIds;
  sort: readonly SortColumn[];
  onSortChange: (next: readonly SortColumn[]) => void;
  emptyKey: MessageKey;
  loaded: boolean;
}

export function HistoryTable({
  columns,
  plays,
  showIds,
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
          <HistoryRow key={play.id} play={play} columns={columns} showIds={showIds} />
        ))}
      </Table.Body>
    </Table.Root>
  );
}
