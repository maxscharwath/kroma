import { createFileRoute } from '@tanstack/react-router';
import { InstallCard } from '#site/components/install-card';
import { ReleaseHeadline } from '#site/components/release-headline';
import { ReleaseRow } from '#site/components/release-row';
import { SiteHeader } from '#site/components/site-header';
import { getCatalog } from '#site/lib/get-catalog';
import { PAGE } from '#site/lib/ui';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Divider } from '#ui/components/atoms/divider';
import { Txt } from '#ui/components/atoms/text';

export const Route = createFileRoute('/browse')({
  loader: () => getCatalog(),
  component: Browse,
});

function Browse() {
  const { rows, repo, fetchedAt, source } = Route.useLoaderData();
  const latest = rows.find((r) => r.channel === 'stable');
  const nightly = rows.find((r) => r.channel === 'nightly');

  return (
    <Box bg="bg" style={{ minHeight: '100%' }}>
      <SiteHeader title="Synology package source" />
      <Box px={28} py={32}>
        <Column gap={32} style={PAGE}>
          <Column gap={10}>
            <Txt variant="hero" style={{ fontSize: 40 }}>
              KROMA for Synology
            </Txt>
            <Txt color="textMuted">
              Self-hosted, direct-play HEVC media streaming for Synology DSM 7 (x86_64). One
              package, no dependencies.
            </Txt>
          </Column>

          <InstallCard url={source} />

          <Row gap={16} style={{ flexWrap: 'wrap', alignItems: 'stretch' }}>
            {latest ? <ReleaseHeadline label="Latest stable" release={latest} primary /> : null}
            {nightly ? <ReleaseHeadline label="Nightly" release={nightly} /> : null}
          </Row>

          <Column gap={12}>
            <Txt variant="overline" color="accentText">
              All releases
            </Txt>
            <Box bg="surface1" radius="xl" style={{ overflow: 'hidden' }}>
              {rows.map((r, i) => (
                <Column key={r.spk}>
                  {i > 0 ? <Divider /> : null}
                  <ReleaseRow release={r} />
                </Column>
              ))}
            </Box>
          </Column>

          <Txt color="textDim" variant="meta">
            Served from github.com/{repo} · catalog refreshed {fetchedAt.slice(0, 16)}
          </Txt>
        </Column>
      </Box>
    </Box>
  );
}
