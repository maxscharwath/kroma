// "What is actually in this one?", asked of a download already in the queue.
//
// The row carries its link on the server, so this asks the module rather than
// handing a magnet back to the browser. Read-only: the torrent is running, and
// which files it takes was settled when it was added.

import type { TorrentAnalysis } from '@kroma/module-acquisition/schemas';
import { apiErrorText, useT } from '@kroma/module-sdk';
import { Box, Callout, Dialog, Row, Spinner, Text } from '@kroma/ui/kit';
import { useEffect, useState } from 'react';
import { createCallable } from 'react-call';
import { useTorrentsApi } from './api';
import { detect, summaryOf } from './manual-grab-content';
import type { DownloadView } from './schemas';
import { TorrentContents } from './torrent-contents';

/** Opened with `ContentsModal.call({ dl })`. */
export const ContentsModal = createCallable<{ dl: DownloadView }, void>(({ call, dl }) => {
  const t = useT();
  const torrents = useTorrentsApi();
  const [contents, setContents] = useState<TorrentAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    torrents
      .contents(dl.id)
      .then(setContents)
      .catch((e) => setError(apiErrorText(e, t('contents.failed'))));
  }, [torrents, dl.id, t]);

  const found = contents ? detect(contents) : null;
  const summary = found?.certain ? summaryOf(found) : null;

  return (
    <Dialog.Root open title={t('contents.title')} onClose={() => call.end()} width="md">
      <Text variant="meta" color="text/50" lines={2}>
        {dl.releaseTitle}
      </Text>
      {summary ? (
        <Text variant="meta" color="text/60">
          {t(`manual.found.${summary.key}`, summary.vars)}
        </Text>
      ) : null}

      {error ? (
        <Callout.Root size="sm" tone="danger" icon="alert-triangle">
          <Callout.Title>{error}</Callout.Title>
        </Callout.Root>
      ) : null}

      {!contents && !error ? (
        <Row center gap={8} py={28}>
          <Spinner />
          <Text variant="meta" color="text/45">
            {t('contents.reading')}
          </Text>
        </Row>
      ) : null}

      {contents ? (
        <Box mt={4}>
          <TorrentContents analysis={contents} />
        </Box>
      ) : null}
    </Dialog.Root>
  );
});
