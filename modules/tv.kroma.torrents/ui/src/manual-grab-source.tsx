// Step one of a manual add: where the torrent comes from.
//
// Three doors onto the same two facts, a link and a release name: search the
// indexers, paste a magnet, or hand over a `.torrent`. The file door reads the
// file on the server and comes back with the magnet that stands for it, so from
// here the three are indistinguishable and the rest of the flow is one path.

import type { ManualReleaseView } from '@kroma/module-acquisition/schemas';
import { apiErrorText, useAsyncAction, useT } from '@kroma/module-sdk';
import { Box, Button, Callout, Field, SegmentGroup, Text } from '@kroma/ui/kit';
import { type CSSProperties, useRef, useState } from 'react';
import { useTorrentsApi } from './api';
import { SearchPanel } from './manual-grab-search';
import type { InspectedTorrent } from './schemas';

const HIDDEN: CSSProperties = { display: 'none' };

type Door = 'search' | 'magnet' | 'file';

/** What every door hands back: the link, and what it is called. */
export interface TorrentSource {
  magnet: string;
  releaseTitle: string;
  detailsUrl: string | null;
  /** Set by the file door, which has already read the release name for us. */
  inspected?: InspectedTorrent;
}

interface SourceStepProps {
  /** Passed straight to the indexer sweep, so "find me S03E07" is one form. */
  search: {
    query: string;
    setQuery: (next: string) => void;
    scopeLabel: string | null;
    searching: boolean;
    searchErr: string | null;
    results: ManualReleaseView[] | null;
    onSearch: () => void;
  };
  onPicked: (source: TorrentSource) => void;
}

export function SourceStep({ search, onPicked }: Readonly<SourceStepProps>) {
  const t = useT();
  const torrents = useTorrentsApi();
  const { busy, error, run } = useAsyncAction();
  const [door, setDoor] = useState<Door>('search');
  const [magnet, setMagnet] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const takeFile = (file: File | undefined) => {
    if (!file) return;
    run(
      async () => {
        const inspected = await torrents.inspectTorrent(file);
        onPicked({
          magnet: inspected.magnet,
          releaseTitle: inspected.releaseTitle,
          detailsUrl: null,
          inspected,
        });
      },
      (e) => apiErrorText(e, t('manual.fileFailed')),
    );
  };

  return (
    <Box gap={14}>
      <SegmentGroup.Root
        value={door}
        onValueChange={setDoor}
        label={t('manual.sourceLabel')}
        stretch
      >
        <SegmentGroup.Item value="search" icon="search">
          <SegmentGroup.Label>{t('manual.sourceSearch')}</SegmentGroup.Label>
        </SegmentGroup.Item>
        <SegmentGroup.Item value="magnet" icon="magnet">
          <SegmentGroup.Label>{t('manual.sourceMagnet')}</SegmentGroup.Label>
        </SegmentGroup.Item>
        <SegmentGroup.Item value="file" icon="file-upload">
          <SegmentGroup.Label>{t('manual.sourceFile')}</SegmentGroup.Label>
        </SegmentGroup.Item>
      </SegmentGroup.Root>

      {door === 'search' ? (
        <SearchPanel
          query={search.query}
          scopeLabel={search.scopeLabel}
          setQuery={search.setQuery}
          searching={search.searching}
          searchErr={search.searchErr}
          results={search.results}
          onSearch={search.onSearch}
          onPick={(release: ManualReleaseView) =>
            onPicked({
              magnet: release.downloadUrl ?? '',
              releaseTitle: release.title,
              detailsUrl: release.detailsUrl ?? null,
            })
          }
        />
      ) : null}

      {door === 'magnet' ? (
        <Box gap={10}>
          <Field.Root label={t('manual.magnet')} value={magnet} onValueChange={setMagnet}>
            <Field.Input placeholder="magnet:?xt=urn:btih:..." />
            <Field.Hint>{t('manual.magnetHint')}</Field.Hint>
          </Field.Root>
          <Button
            variant="primary"
            icon="arrow-right"
            label={t('manual.next')}
            disabled={!magnet.trim()}
            onPress={() => onPicked({ magnet: magnet.trim(), releaseTitle: '', detailsUrl: null })}
          />
        </Box>
      ) : null}

      {door === 'file' ? (
        <Box gap={10} py={8} center>
          <input
            ref={input}
            type="file"
            accept=".torrent,application/x-bittorrent"
            style={HIDDEN}
            onChange={(e) => {
              takeFile(e.target.files?.[0]);
              // Cleared so picking the SAME file again still fires a change.
              e.target.value = '';
            }}
          />
          <Button
            variant="glass"
            icon="file-upload"
            label={t('manual.chooseFile')}
            onPress={() => input.current?.click()}
            loading={busy}
          />
          <Text variant="meta" color="text/40">
            {t('manual.fileHint')}
          </Text>
        </Box>
      ) : null}

      {error ? (
        <Callout.Root size="sm" tone="danger" icon="alert-triangle">
          <Callout.Title>{error}</Callout.Title>
        </Callout.Root>
      ) : null}
    </Box>
  );
}
