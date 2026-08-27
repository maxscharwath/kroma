// The bar that narrows the queue.
//
// Every filter is a SET, not a single choice: an operator watching a busy queue
// wants "failed and paused", or "seasons and episodes", and being made to look
// at one at a time is what made the old single-select bar useless. So each
// filter is a row of toggles, nothing selected means everything, and each one
// carries a glyph and its count so the row is read by shape.

import { useT } from '@kroma/module-sdk';
import type { IconName } from '@kroma/ui/kit';
import { Box, Button, Chip, Divider, Field, Row } from '@kroma/ui/kit';
import type { DownloadClientView, DownloadQuery, DownloadStatsView } from './schemas';

interface Facet {
  value: string;
  icon: IconName;
}

// The status groups, expanded by the server. `all` is not offered: clearing
// every chip is what "all" means, and a chip that undoes the others is a
// different control wearing the same clothes.
const GROUPS = [
  { value: 'active', icon: 'download' },
  { value: 'done', icon: 'circle-check' },
  { value: 'failed', icon: 'alert-triangle' },
] as const satisfies readonly Facet[];

const GROUP_STATUSES: Record<string, readonly string[]> = {
  active: ['queued', 'downloading', 'seeding', 'paused'],
  done: ['completed', 'imported'],
  failed: ['failed', 'removed'],
};

const KINDS = [
  { value: 'movie', icon: 'movie' },
  { value: 'season', icon: 'stack' },
  { value: 'episode', icon: 'device-tv' },
] as const satisfies readonly Facet[];

const SEPARATOR = ',';

function selected(value: string | undefined): string[] {
  return value ? value.split(SEPARATOR).filter(Boolean) : [];
}

// Adding what is missing and removing what is there, which is what every one of
// these toggles does.
function toggled(current: string | undefined, value: string): string | undefined {
  const list = selected(current);
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  return next.length > 0 ? next.join(SEPARATOR) : undefined;
}

// How many rows a status chip would add, from the whole-ledger rollup rather
// than from the page in hand.
function countFor(group: string, byStatus: Record<string, number>): number {
  return (GROUP_STATUSES[group] ?? []).reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);
}

interface DownloadFiltersProps {
  query: DownloadQuery;
  onQueryChange: (next: DownloadQuery) => void;
  stats: DownloadStatsView;
  clients: readonly DownloadClientView[];
  /** The text IN the box, which the page settles into `query.q` after a pause.
   *  Held by the caller so a keystroke never re-keys the queue's poll. */
  search: string;
  onSearchChange: (next: string) => void;
}

/** The queue's filter bar. Changing anything resets to the first page, because
 *  page 4 of a different filter is a different list. */
export function DownloadFilters({
  query,
  onQueryChange,
  stats,
  clients,
  search,
  onSearchChange,
}: Readonly<DownloadFiltersProps>) {
  const t = useT();
  const set = (patch: Partial<DownloadQuery>) => onQueryChange({ ...query, ...patch, page: 1 });
  const narrowed =
    Boolean(query.status || query.kind || query.clientId || query.unlinked) ||
    Boolean(search.trim());

  return (
    <Box mb={14} gap={10}>
      <Row wrap gap={10} align="center">
        <Field.Root
          label={t('downloads.searchLabel')}
          hideLabel
          flex
          minW={240}
          size="sm"
          value={search}
          onValueChange={onSearchChange}
        >
          <Field.Input icon="search" placeholder={t('downloads.searchPlaceholder')} />
        </Field.Root>
        {narrowed ? (
          <Button
            variant="ghost"
            size="sm"
            icon="x"
            label={t('downloads.clearFilters')}
            onPress={() => {
              onSearchChange('');
              onQueryChange({ page: 1 });
            }}
          />
        ) : null}
      </Row>

      <Row wrap gap={8} align="center">
        {GROUPS.map(({ value, icon }) => (
          <Chip
            key={value}
            variant="surface"
            icon={icon}
            label={t(`downloads.group.${value}`)}
            count={countFor(value, stats.byStatus)}
            active={selected(query.status).includes(value)}
            onPress={() => set({ status: toggled(query.status, value) })}
          />
        ))}
        <Box h={20} center>
          <Divider vertical />
        </Box>
        {KINDS.map(({ value, icon }) => (
          <Chip
            key={value}
            variant="surface"
            icon={icon}
            label={t(`downloads.kind.${value}`)}
            active={selected(query.kind).includes(value)}
            onPress={() => set({ kind: toggled(query.kind, value) })}
          />
        ))}
        <Box h={20} center>
          <Divider vertical />
        </Box>
        <Chip
          variant="surface"
          icon="link-off"
          label={t('downloads.filterUnlinked')}
          active={query.unlinked === true}
          onPress={() => set({ unlinked: query.unlinked ? undefined : true })}
        />
        {/* One engine is not a choice; naming it would only take up room. */}
        {clients.length > 1
          ? clients.map((client) => (
              <Chip
                key={client.id}
                variant="surface"
                icon="server"
                label={client.name}
                active={selected(query.clientId).includes(client.id)}
                onPress={() => set({ clientId: toggled(query.clientId, client.id) })}
              />
            ))
          : null}
      </Row>
    </Box>
  );
}
