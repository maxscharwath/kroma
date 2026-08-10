import { Action } from '#site/components/action';
import type { Release } from '#site/lib/release';
import { MONO } from '#site/lib/ui';
import { Badge } from '#ui/components/atoms/badge';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Txt } from '#ui/components/atoms/text';

export interface ReleaseHeadlineProps {
  label: string;
  release: Release;
  primary?: boolean;
}

export function ReleaseHeadline({
  label,
  release,
  primary = false,
}: Readonly<ReleaseHeadlineProps>) {
  return (
    <Box bg="surface1" p={20} radius="xl" style={{ flexGrow: 1, flexBasis: 280 }}>
      <Column gap={10}>
        <Row gap={8} style={{ alignItems: 'center' }}>
          <Txt variant="overline" color="textDim">
            {label}
          </Txt>
          {release.channel === 'nightly' ? <Badge tone="warning">beta</Badge> : null}
        </Row>
        <Txt variant="h2" style={MONO}>
          {release.version}
        </Txt>
        <Txt color="textMuted" variant="meta">
          {release.day} · {release.size}
        </Txt>
        <Row gap={8} style={{ marginTop: 4, flexWrap: 'wrap' }}>
          <Action tone={primary ? 'primary' : 'outline'} href={release.spk}>
            Download
          </Action>
          <Action tone="ghost" href={release.release}>
            Notes
          </Action>
        </Row>
      </Column>
    </Box>
  );
}
