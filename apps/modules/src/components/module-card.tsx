import type { ModuleEntry } from '#site/catalog';
import { depList } from '#site/lib/deps';
import { MONO, mb, shortTarget } from '#site/lib/ui';
import { Badge } from '#ui/components/atoms/badge';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Img } from '#ui/components/atoms/img';
import { Txt } from '#ui/components/atoms/text';

export function ModuleCard({ module: m }: Readonly<{ module: ModuleEntry }>) {
  const deps = depList(m.dependsOn);
  const targets = (m.artifacts ?? []).map((a) => a.target || 'universal');

  return (
    <Box bg="surface1" p={18} radius="xl" style={{ flexGrow: 1, flexBasis: 300, maxWidth: 360 }}>
      <Column gap={12} style={{ height: '100%' }}>
        <Row gap={12} style={{ alignItems: 'center' }}>
          <Box bg="surface2" radius="md" style={{ width: 44, height: 44 }}>
            <Img src={m.icon ?? null} fill fit="contain" radius={10} />
          </Box>
          <Column gap={2} style={{ minWidth: 0, flexGrow: 1 }}>
            <Txt variant="label">{m.name}</Txt>
            <Txt color="textDim" variant="meta" style={MONO}>
              {m.id}
            </Txt>
          </Column>
          <Badge tone="neutral">v{m.version}</Badge>
        </Row>

        {m.description ? (
          <Txt color="textMuted" variant="meta" lines={3}>
            {m.description}
          </Txt>
        ) : null}

        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {(m.provides ?? []).map((c) => (
            <Badge key={`${c.kind}:${c.id}`} tone="success">
              {c.kind}
            </Badge>
          ))}
          {m.library ? <Badge tone="info">bibliothèque</Badge> : null}
          {targets.map((t) => (
            <Badge key={t} tone="neutral">
              {shortTarget(t)}
            </Badge>
          ))}
        </Row>

        {deps.length > 0 ? (
          <Txt color="textDim" variant="meta">
            requiert {deps.join(', ')}
          </Txt>
        ) : null}

        <Txt color="textDim" variant="meta" style={{ marginTop: 'auto' }}>
          {m.minServer ? `serveur ≥ ${m.minServer}` : ''}
          {m.minServer && m.size ? ' · ' : ''}
          {mb(m.size)}
        </Txt>
      </Column>
    </Box>
  );
}
