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
      <SiteHeader title="Source de paquets Synology" />
      <Box px={28} py={32}>
        <Column gap={32} style={PAGE}>
          <Column gap={10}>
            <Txt variant="hero" style={{ fontSize: 40 }}>
              KROMA pour Synology
            </Txt>
            <Txt color="textMuted">
              Streaming direct-play HEVC auto-hébergé, pour DSM 7 (x86_64). Un paquet, aucune
              dépendance.
            </Txt>
          </Column>

          <InstallCard url={source} />

          <Row gap={16} style={{ flexWrap: 'wrap', alignItems: 'stretch' }}>
            {latest ? (
              <ReleaseHeadline label="Dernière version stable" release={latest} primary />
            ) : null}
            {nightly ? <ReleaseHeadline label="Nightly" release={nightly} /> : null}
          </Row>

          <Column gap={12}>
            <Txt variant="overline" color="accentText">
              Toutes les versions
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
            Servi depuis github.com/{repo} · catalogue rafraîchi {fetchedAt.slice(0, 16)}
          </Txt>
        </Column>
      </Box>
    </Box>
  );
}
