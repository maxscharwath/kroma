// Everything a torrent turns out to hold, laid out the way it is shaped.
//
// A flat list of paths is what the torrent gives you; it is not what an operator
// is looking at. A season pack is seasons of episodes, a film is one file beside
// its extras, and grouping it that way is what makes "is this the whole season?"
// answerable at a glance instead of by counting rows.
//
// One component for both callers: the manual add, where the rows are selectable
// because narrowing the grab is the point, and the queue's own menu, where they
// are not because the torrent is already running.

import type { TorrentAnalysis, TorrentFileView } from '@kroma/module-acquisition/schemas';
import { useFormat, useT } from '@kroma/module-sdk';
import type { IconName } from '@kroma/ui/kit';
import { Badge, Box, Button, Checkbox, Icon, Row, styles, Text } from '@kroma/ui/kit';
import { useMemo } from 'react';

const s = styles({
  tabular: { fontVariant: ['tabular-nums'] },
});

/** Selectable rows. Omit the whole thing for a read-only view. */
export interface ContentsSelection {
  selected: Set<number>;
  onToggle: (index: number) => void;
  /** Replaces the whole set, for a group's select-all. */
  onSet: (next: Set<number>) => void;
}

/** One run of files that belong together. */
type GroupKind = 'season' | 'film' | 'extras';

interface Group {
  key: string;
  kind: GroupKind;
  /** Only a `season` group has one. */
  season: number | null;
  files: TorrentFileView[];
}

const GROUP_ICON: Record<GroupKind, IconName> = {
  season: 'stack',
  film: 'movie',
  extras: 'file-text',
};

const bytesOf = (files: readonly TorrentFileView[]) =>
  files.reduce((sum, file) => sum + file.sizeBytes, 0);

const fileName = (path: string) => path.split('/').pop() ?? path;

// Episodes by season, then the video with no episode (a film), then everything
// that is not video at all. Sorted, because a torrent's own order is arbitrary.
function group(files: readonly TorrentFileView[]): Group[] {
  const bySeason = new Map<number, TorrentFileView[]>();
  const loose: TorrentFileView[] = [];
  const extras: TorrentFileView[] = [];
  for (const file of files) {
    if (!file.isVideo) {
      extras.push(file);
      continue;
    }
    if (file.episode === null) {
      loose.push(file);
      continue;
    }
    const season = file.season ?? 0;
    const at = bySeason.get(season) ?? [];
    at.push(file);
    bySeason.set(season, at);
  }

  const out: Group[] = [...bySeason.entries()]
    .sort(([a], [b]) => a - b)
    .map(([season, seasonFiles]) => ({
      key: `s${season}`,
      kind: 'season' as const,
      season,
      files: [...seasonFiles].sort((a, b) => (a.episode ?? 0) - (b.episode ?? 0)),
    }));
  if (loose.length > 0) out.push({ key: 'film', kind: 'film', season: null, files: loose });
  if (extras.length > 0) out.push({ key: 'extras', kind: 'extras', season: null, files: extras });
  return out;
}

interface TorrentContentsProps {
  analysis: TorrentAnalysis;
  /** Given, every video row becomes a checkbox and each group gets a toggle. */
  selection?: ContentsSelection;
}

export function TorrentContents({ analysis, selection }: Readonly<TorrentContentsProps>) {
  const t = useT();
  const fmt = useFormat();
  const groups = useMemo(() => group(analysis.files), [analysis.files]);
  const videos = useMemo(() => analysis.files.filter((f) => f.isVideo), [analysis.files]);

  return (
    <Box gap={10}>
      <Row between wrap gap={12} align="center">
        <Text variant="meta" color="text/50">
          {t('contents.total', {
            files: String(videos.length),
            size: fmt.bytes(bytesOf(analysis.files)),
          })}
        </Text>
        {selection && videos.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            label={
              selection.selected.size === videos.length
                ? t('contents.selectNone')
                : t('contents.selectAll')
            }
            onPress={() =>
              selection.onSet(
                selection.selected.size === videos.length
                  ? new Set()
                  : new Set(videos.map((f) => f.index)),
              )
            }
          />
        ) : null}
      </Row>

      <Box gap={12} maxH={340} overflow="scroll">
        {groups.map((found) => (
          <GroupBlock key={found.key} group={found} selection={selection} />
        ))}
      </Box>
    </Box>
  );
}

function GroupBlock({
  group: found,
  selection,
}: Readonly<{ group: Group; selection?: ContentsSelection }>) {
  const t = useT();
  const fmt = useFormat();
  const selectable = selection && found.kind !== 'extras';
  const picked = found.files.filter((f) => selection?.selected.has(f.index)).length;
  const all = picked === found.files.length;
  const heading = headingOf(found, t);

  return (
    <Box gap={4}>
      <Row between gap={10} align="center">
        <Row gap={6} align="center" minW={0}>
          <Icon name={GROUP_ICON[found.kind]} size={12} thickness={2} color="glyphDim" />
          <Text variant="overline" color="textDim" lines={1}>
            {heading}
          </Text>
          <Text variant="meta" color="text/30" shrink={0} style={s.tabular}>
            {fmt.bytes(bytesOf(found.files))}
          </Text>
        </Row>
        {selectable && found.files.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            label={all ? t('contents.selectNone') : t('contents.selectAll')}
            onPress={() => {
              const next = new Set(selection.selected);
              for (const file of found.files) {
                if (all) next.delete(file.index);
                else next.add(file.index);
              }
              selection.onSet(next);
            }}
          />
        ) : null}
      </Row>
      <Box>
        {found.files.map((file) => (
          <FileRow key={file.index} file={file} selection={selectable ? selection : undefined} />
        ))}
      </Box>
    </Box>
  );
}

// What the group is called, which is the one thing that differs per kind.
function headingOf(found: Group, t: ReturnType<typeof useT>): string {
  if (found.kind === 'extras') return t('contents.extras', { count: String(found.files.length) });
  if (found.kind === 'film') return t('contents.film');
  return t('contents.season', {
    season: String(found.season ?? 0),
    episodes: String(found.files.length),
  });
}

function FileRow({
  file,
  selection,
}: Readonly<{ file: TorrentFileView; selection?: ContentsSelection }>) {
  const fmt = useFormat();
  const tag = file.episode === null ? null : `E${String(file.episode).padStart(2, '0')}`;
  return (
    <Row gap={10} align="center" py={5} px={6} radius="sm" minW={0} bg="transparent">
      {selection ? (
        <Checkbox
          checked={selection.selected.has(file.index)}
          onCheckedChange={() => selection.onToggle(file.index)}
          label={fileName(file.path)}
        />
      ) : null}
      {tag ? <Badge tone="info">{tag}</Badge> : null}
      <Text
        variant="meta"
        color={file.isVideo ? 'text/70' : 'text/35'}
        flex
        minW={0}
        lines={1}
        accessibilityLabel={file.path}
      >
        {fileName(file.path)}
      </Text>
      <Text variant="meta" color="text/35" shrink={0} style={s.tabular}>
        {fmt.bytes(file.sizeBytes)}
      </Text>
    </Row>
  );
}

export { bytesOf, group as groupContents };
