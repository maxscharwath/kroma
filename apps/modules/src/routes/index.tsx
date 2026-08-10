import { createFileRoute } from '@tanstack/react-router';
import { ModuleCard } from '#site/components/module-card';
import { RegistryUrl } from '#site/components/registry-url';
import { SiteHeader } from '#site/components/site-header';
import { getCatalog } from '#site/lib/get-catalog';
import { PAGE } from '#site/lib/ui';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Txt } from '#ui/components/atoms/text';

export const Route = createFileRoute('/')({
  loader: () => getCatalog(),
  component: Registry,
});

function Registry() {
  const { modules, generatedAt, registry } = Route.useLoaderData();
  const plural = modules.length === 1 ? '' : 's';
  const updated = generatedAt ? ` · mis à jour ${generatedAt.slice(0, 10)}` : '';

  return (
    <Box bg="bg" style={{ minHeight: '100%' }}>
      <SiteHeader title="Registre de modules" />
      <Box px={28} py={32}>
        <Column gap={32} style={PAGE}>
          <Column gap={10}>
            <Txt variant="hero" style={{ fontSize: 40 }}>
              Modules KROMA
            </Txt>
            <Txt color="textMuted">
              Téléchargements, indexeurs, VPN, transcription : installés directement depuis
              l'administration de votre serveur.
            </Txt>
          </Column>

          <RegistryUrl
            url={registry}
            note={`Administration → Modules → Registres. ${modules.length} module${plural} disponible${plural}${updated}`}
          />

          <Row gap={16} style={{ flexWrap: 'wrap', alignItems: 'stretch' }}>
            {modules.map((m) => (
              <ModuleCard key={m.id} module={m} />
            ))}
          </Row>
        </Column>
      </Box>
    </Box>
  );
}
