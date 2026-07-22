// The browse screen's chrome, split out of TvGrid: the fixed-height header that
// echoes the focused tile (section label + count, title, rating, meta line,
// quality badge) and the slim sort/genre chip strip under it. Both are
// presentational and driven entirely by props, so the screen file keeps only its
// state, its lists and the poster grid.

import {
  formatRuntime,
  type GenreCount,
  type MessageKey,
  qualityBadge,
  qualityBadgeForVideo,
  SORT_MODES,
  type SortMode,
} from '@kroma/core';
import { useT } from '@kroma/ui';
import { Badge, Box, Chip, Divider, qualityTone, Txt } from '@kroma/ui/kit';
import { ScrollView } from 'react-native';
import type { CatalogEntry } from '#tv/features/catalog/home/AmbientBackdrop';

const SORT_LABEL_KEY: Record<SortMode, MessageKey> = {
  added: 'browse.sort.added',
  release: 'browse.sort.release',
  title: 'browse.sort.title',
  rating: 'browse.sort.rating',
};

/** Meta line under the focused title: year · runtime|seasons · lead genres. */
function entryLine(e: CatalogEntry, seasons: string | null): string {
  const mid = e.kind === 'movie' ? formatRuntime(e.item.durationMs) : seasons;
  const genres = e.item.metadata?.genres?.slice(0, 2) ?? [];
  return [e.item.year ? String(e.item.year) : null, mid, ...genres].filter(Boolean).join(' · ');
}

/** The focused entry's quality badge (a series carries its video on the show). */
function entryBadge(e: CatalogEntry): string | null {
  return e.kind === 'movie' ? qualityBadge(e.item) : qualityBadgeForVideo(e.item.video);
}

const SECTION_LABEL = {
  fontWeight: '700' as const,
  fontSize: 13,
  lineHeight: 16,
  letterSpacing: 2.86,
  textTransform: 'uppercase' as const,
};

// The design sizes this with clamp(30px, 4.8vh, 46px). On the fixed 1920x1080
// stage that always resolves to the 46px ceiling, so it is spelled out: a
// viewport unit would mean something different on each of the four targets.
const ECHO_TITLE = {
  fontSize: 46,
  lineHeight: 48,
  fontWeight: '700' as const,
  letterSpacing: -0.92,
};

/**
 * Fixed-height header (content pinned to the bottom) so the grid never reflows
 * as the focus echo swaps titles; one truncated line keeps that guarantee.
 */
export function BrowseHeader({
  label,
  count,
  hasItems,
  focused,
}: Readonly<{
  label: string;
  count: number;
  hasItems: boolean;
  focused: CatalogEntry | null;
}>) {
  return (
    <Box h={208} shrink={0} justify="flex-end" px={64} pb={8}>
      <Txt style={SECTION_LABEL} color="accent">
        {label}
        {hasItems ? <Txt style={SECTION_LABEL} color="textDim">{` · ${count}`}</Txt> : null}
      </Txt>
      {focused ? <FocusEcho entry={focused} /> : null}
    </Box>
  );
}

/** The focused tile's title + meta line. */
function FocusEcho({ entry }: Readonly<{ entry: CatalogEntry }>) {
  const t = useT();
  const rating = entry.item.metadata?.rating;
  const badge = entryBadge(entry);
  const seasons =
    entry.kind === 'show' ? t('content.seasonCount', { count: entry.item.seasonCount }) : null;
  return (
    <Box mt={8} gap={6}>
      <Txt variant="hero" style={[ECHO_TITLE, { maxWidth: 960 }]} lines={1}>
        {entry.item.title}
      </Txt>
      <Box row align="center" gap={10}>
        {rating ? (
          <Txt style={{ fontSize: 15, fontWeight: '700' }} color="accent">
            {`${rating.toFixed(1)}★`}
          </Txt>
        ) : null}
        <Txt style={{ fontSize: 15, fontWeight: '600' }} color="textMuted">
          {entryLine(entry, seasons)}
        </Txt>
        {badge ? <Badge tone={qualityTone(badge)}>{badge}</Badge> : null}
      </Box>
    </Box>
  );
}

/** The sort + genre chip strip: every sort mode, then (when the section has any)
 * an "all genres" chip and one chip per genre. */
export function BrowseFilters({
  sort,
  onSort,
  genres,
  genre,
  onGenre,
}: Readonly<{
  sort: SortMode;
  onSort: (mode: SortMode) => void;
  genres: GenreCount[];
  genre: string | undefined;
  onGenre: (name: string | undefined) => void;
}>) {
  const t = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 64,
        paddingVertical: 12,
      }}
    >
      {SORT_MODES.map((mode) => (
        <Chip
          key={mode}
          variant="subtle"
          focusScale={1.06}
          active={mode === sort}
          label={t(SORT_LABEL_KEY[mode])}
          onPress={() => onSort(mode)}
        />
      ))}
      {genres.length > 0 ? (
        <>
          <Box mx={4}>
            <Divider vertical size={1} color="rgba(255, 255, 255, 0.14)" />
          </Box>
          <Chip
            variant="subtle"
            focusScale={1.06}
            active={!genre}
            label={t('browse.allGenres')}
            onPress={() => onGenre(undefined)}
          />
          {genres.map((g) => (
            <Chip
              key={g.name}
              variant="subtle"
              focusScale={1.06}
              active={g.name === genre}
              label={g.name}
              onPress={() => onGenre(g.name)}
            />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
