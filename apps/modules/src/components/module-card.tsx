import type { ModuleEntry } from '#site/catalog';
import { depList } from '#site/lib/deps';
import { mb, shortTarget } from '#site/lib/ui';
import { Badge } from '#ui/components/atoms/badge';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Img } from '#ui/components/atoms/img';
import { Txt } from '#ui/components/atoms/text';

export function ModuleCard({ module: m }: Readonly<{ module: ModuleEntry }>) {
  const deps = depList(m.dependsOn);
  const targets = (m.artifacts ?? []).map((a) => a.target || 'universal');

  return (
    <Box bg="surface1" p={18} radius="xl" grow={1} maxW={360} basis={300}>
      <Column gap={12} h="100%">
        <Row gap={12}>
          <Box bg="surface2" radius="md" w={44} h={44}>
            <Img src={m.icon ?? null} fill fit="contain" radius={10} />
          </Box>
          <Column gap={2} minW={0} grow={1}>
            <Txt variant="label">{m.name}</Txt>
            <Txt color="textDim" variant="meta" font="mono">
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

        <Row gap={6} wrap>
          {(m.provides ?? []).map((c) => (
            <Badge key={`${c.kind}:${c.id}`} tone="success">
              {c.kind}
            </Badge>
          ))}
          {m.library ? <Badge tone="info">library</Badge> : null}
          {targets.map((t) => (
            <Badge key={t} tone="neutral">
              {shortTarget(t)}
            </Badge>
          ))}
        </Row>

        {deps.length > 0 ? (
          <Txt color="textDim" variant="meta">
            needs {deps.join(', ')}
          </Txt>
        ) : null}

        <Box mt="auto">
          <Txt color="textDim" variant="meta">
            {m.minServer ? `server ≥ ${m.minServer}` : ''}
            {m.minServer && m.size ? ' · ' : ''}
            {mb(m.size)}
          </Txt>
        </Box>
      </Column>
    </Box>
  );
}
