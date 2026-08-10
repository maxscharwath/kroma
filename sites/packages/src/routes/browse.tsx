import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { dsmVersion, type Entry, entryVersion, loadCatalog } from '#pkg/lib/catalog';
import { Badge } from '#ui/components/atoms/badge';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Divider } from '#ui/components/atoms/divider';
import { Txt } from '#ui/components/atoms/text';

type Release = {
  channel: 'stable' | 'nightly';
  version: string;
  day: string;
  size: string;
  spk: string;
  release: string;
};

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

const toRow = (e: Entry): Release => ({
  channel: e.channel,
  version: dsmVersion(entryVersion(e)),
  day: e.publishedAt ? e.publishedAt.slice(0, 10) : '',
  size: mb(e.info?.size ?? e.spkSize),
  spk: e.spkUrl,
  release: e.releaseUrl,
});

// `cloudflare:workers` is only importable inside workerd; in `vite dev` the
// catalog simply loads anonymously.
async function workerEnv(): Promise<Record<string, string>> {
  try {
    const mod = (await import(/* @vite-ignore */ 'cloudflare:workers')) as {
      env?: Record<string, string>;
    };
    return mod.env ?? {};
  } catch {
    return {};
  }
}

const getCatalog = createServerFn().handler(async () => {
  const catalog = await loadCatalog(await workerEnv(), () => undefined);
  return { fetchedAt: catalog.fetchedAt, repo: catalog.repo, rows: catalog.entries.map(toRow) };
});

export const Route = createFileRoute('/browse')({
  loader: () => getCatalog(),
  component: Browse,
});

function Browse() {
  const { rows, repo, fetchedAt } = Route.useLoaderData();
  const latest = rows.find((r) => r.channel === 'stable');
  const nightly = rows.find((r) => r.channel === 'nightly');

  return (
    <Box bg="bg" style={{ minHeight: '100%' }}>
      <Box style={{ maxWidth: 860, marginLeft: 'auto', marginRight: 'auto' }} p={28}>
        <Column gap={28}>
          <Column gap={10}>
            <Txt variant="h1">KROMA package source</Txt>
            <Txt color="textMuted">
              Self-hosted, direct-play HEVC media streaming for Synology DSM 7 (x86_64).
            </Txt>
          </Column>

          <Column gap={10}>
            <Txt variant="overline" color="accentText">
              Install
            </Txt>
            <Txt color="textMuted">
              Package Center → Settings → Package Sources → Add, then paste this URL.
            </Txt>
            <Box bg="surface1" p={14} radius="md">
              <Txt style={{ fontFamily: 'ui-monospace, monospace' }}>
                https://packages.kroma.tv/
              </Txt>
            </Box>
            <Txt color="textDim" variant="meta">
              KROMA appears in the Community tab and auto-updates with each release. Enable beta
              packages to ride the nightly channel instead.
            </Txt>
          </Column>

          <Row gap={16} style={{ flexWrap: 'wrap' }}>
            {latest ? <Headline label="Latest stable" row={latest} /> : null}
            {nightly ? <Headline label="Nightly" row={nightly} /> : null}
          </Row>

          <Column gap={10}>
            <Txt variant="overline" color="accentText">
              All releases
            </Txt>
            <Box bg="surface1" radius="lg" style={{ overflow: 'hidden' }}>
              {rows.map((r, i) => (
                <Column key={r.spk}>
                  {i > 0 ? <Divider /> : null}
                  <Row
                    gap={12}
                    p={14}
                    style={{ alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Row gap={10} style={{ alignItems: 'center', minWidth: 0 }}>
                      <Txt style={{ fontFamily: 'ui-monospace, monospace' }}>{r.version}</Txt>
                      {r.channel === 'nightly' ? <Badge tone="warning">nightly</Badge> : null}
                    </Row>
                    <Row gap={14} style={{ alignItems: 'center' }}>
                      <Txt color="textDim" variant="meta">
                        {r.day}
                      </Txt>
                      <Txt color="textDim" variant="meta">
                        {r.size}
                      </Txt>
                      <a href={r.spk}>
                        <Txt color="accentText" variant="meta">
                          .spk
                        </Txt>
                      </a>
                      <a href={r.release}>
                        <Txt color="textMuted" variant="meta">
                          notes
                        </Txt>
                      </a>
                    </Row>
                  </Row>
                </Column>
              ))}
            </Box>
          </Column>

          <Txt color="textDim" variant="meta">
            Served live from github.com/{repo} · catalog refreshed {fetchedAt}
          </Txt>
        </Column>
      </Box>
    </Box>
  );
}

function Headline({ label, row }: Readonly<{ label: string; row: Release }>) {
  return (
    <Box bg="surface1" p={18} radius="lg" style={{ flexGrow: 1, minWidth: 260 }}>
      <Column gap={6}>
        <Txt variant="overline" color="textDim">
          {label}
        </Txt>
        <Txt variant="title" style={{ fontFamily: 'ui-monospace, monospace' }}>
          {row.version}
        </Txt>
        <Txt color="textMuted" variant="meta">
          {row.day} · {row.size}
        </Txt>
        <a href={row.spk}>
          <Txt color="accentText" variant="meta">
            Download .spk
          </Txt>
        </a>
      </Column>
    </Box>
  );
}
