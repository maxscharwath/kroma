import { Action } from '#site/components/action';
import type { Release } from '#site/lib/release';
import { MONO } from '#site/lib/ui';
import { Badge } from '#ui/components/atoms/badge';
import { Row } from '#ui/components/atoms/box';
import { Txt } from '#ui/components/atoms/text';

export function ReleaseRow({ release }: Readonly<{ release: Release }>) {
  return (
    <Row gap={12} px={18} py={14} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <Row gap={10} style={{ alignItems: 'center', minWidth: 0 }}>
        <Txt style={MONO}>{release.version}</Txt>
        {release.channel === 'nightly' ? <Badge tone="warning">nightly</Badge> : null}
      </Row>
      <Row gap={16} style={{ alignItems: 'center' }}>
        <Txt color="textDim" variant="meta">
          {release.day}
        </Txt>
        <Txt color="textDim" variant="meta">
          {release.size}
        </Txt>
        <Action tone="ghost" href={release.spk}>
          .spk
        </Action>
      </Row>
    </Row>
  );
}
