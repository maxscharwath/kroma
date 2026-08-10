import type { Release } from '#site/lib/release';
import { Badge } from '#ui/components/atoms/badge';
import { Row } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
import { Txt } from '#ui/components/atoms/text';

export function ReleaseRow({ release }: Readonly<{ release: Release }>) {
  return (
    <Row gap={12} px={18} py={14} between>
      <Row gap={10} minW={0}>
        <Txt font="mono">{release.version}</Txt>
        {release.channel === 'nightly' ? <Badge tone="warning">nightly</Badge> : null}
      </Row>
      <Row gap={16}>
        <Txt color="textDim" variant="meta">
          {release.day}
        </Txt>
        <Txt color="textDim" variant="meta">
          {release.size}
        </Txt>
        <Button variant="ghost" size="sm" href={release.spk} label=".spk" />
      </Row>
    </Row>
  );
}
