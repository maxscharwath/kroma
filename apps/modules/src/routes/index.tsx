import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Catalog, depList, type ModuleEntry } from '#site/catalog';
import { loadCatalog } from '#site/lib/source';
import { workerContext } from '#site/lib/worker-env';
import { Badge } from '#ui/components/atoms/badge';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Img } from '#ui/components/atoms/img';
import { Txt } from '#ui/components/atoms/text';

const getCatalog = createServerFn().handler(async () => {
  const { env, waitUntil } = await workerContext();
  const body = await loadCatalog(env, waitUntil);
  if (!body) return { modules: [] as ModuleEntry[], generatedAt: null };
  const parsed = Catalog.safeParse(JSON.parse(body));
  return parsed.success
    ? { modules: parsed.data.modules, generatedAt: parsed.data.generatedAt ?? null }
    : { modules: [] as ModuleEntry[], generatedAt: null };
});

export const Route = createFileRoute('/')({
  loader: () => getCatalog(),
  component: Registry,
});

const mb = (n?: number | null) => {
  if (!n) return '';
  if (n < 1048576) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
};

function Registry() {
  const { modules, generatedAt } = Route.useLoaderData();
  const updated = generatedAt ? ` · updated ${generatedAt.slice(0, 10)}` : '';

  return (
    <Box bg="bg" style={{ minHeight: '100%' }}>
      <Box style={{ maxWidth: 1080, marginLeft: 'auto', marginRight: 'auto' }} p={28}>
        <Column gap={28}>
          <Column gap={10}>
            <Txt variant="h1">KROMA Modules</Txt>
            <Txt color="textMuted">
              Downloads, indexers, VPN, transcription and more, installed straight from your
              server's admin.
            </Txt>
          </Column>

          <Column gap={8}>
            <Txt variant="overline" color="accentText">
              Registry URL
            </Txt>
            <Box bg="surface1" p={14} radius="md">
              <Txt style={{ fontFamily: 'ui-monospace, monospace' }}>
                https://modules.kroma.tv/modules.json
              </Txt>
            </Box>
            <Txt color="textDim" variant="meta">
              Admin → Modules → Registries. {modules.length} module
              {modules.length === 1 ? '' : 's'} available{updated}
            </Txt>
          </Column>

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

function ModuleCard({ module: m }: Readonly<{ module: ModuleEntry }>) {
  const deps = depList(m.dependsOn);
  const targets = (m.artifacts ?? []).map((a) => a.target || 'universal');

  return (
    <Box bg="surface1" p={18} radius="xl" style={{ flexGrow: 1, flexBasis: 300, maxWidth: 380 }}>
      <Column gap={10}>
        <Row gap={12} style={{ alignItems: 'center' }}>
          <Box bg="surface2" radius="md" style={{ width: 44, height: 44, overflow: 'hidden' }}>
            {m.icon ? <Img src={m.icon} /> : null}
          </Box>
          <Column gap={2} style={{ minWidth: 0, flexGrow: 1 }}>
            <Txt variant="label">{m.name}</Txt>
            <Txt color="textDim" variant="meta" style={{ fontFamily: 'ui-monospace, monospace' }}>
              {m.id}
            </Txt>
          </Column>
          <Txt color="textMuted" variant="meta" style={{ fontFamily: 'ui-monospace, monospace' }}>
            v{m.version}
          </Txt>
        </Row>

        {m.description ? (
          <Txt color="textMuted" variant="meta">
            {m.description}
          </Txt>
        ) : null}

        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {targets.map((t) => (
            <Badge key={t} tone="neutral">
              {t}
            </Badge>
          ))}
          {(m.provides ?? []).map((c) => (
            <Badge key={`${c.kind}:${c.id}`} tone="success">
              {c.kind}:{c.id}
            </Badge>
          ))}
          {m.library ? <Badge tone="neutral">library</Badge> : null}
        </Row>

        {deps.length > 0 ? (
          <Txt color="textDim" variant="meta">
            needs {deps.join(', ')}
          </Txt>
        ) : null}

        <Txt color="textDim" variant="meta">
          {m.minServer ? `server ≥ ${m.minServer}` : ''}
          {m.minServer && m.size ? ' · ' : ''}
          {mb(m.size)}
        </Txt>
      </Column>
    </Box>
  );
}
