import { NotesAction } from '#site/components/notes-action';
import type { Release } from '#site/lib/release';
import { Badge } from '#ui/components/atoms/badge';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
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
    <Box bg="surface1" p={20} radius="xl" grow={1} basis={280}>
      <Column gap={10}>
        <Row gap={8}>
          <Txt variant="overline" color="textDim">
            {label}
          </Txt>
          {release.channel === 'nightly' ? <Badge tone="warning">beta</Badge> : null}
        </Row>
        <Txt variant="h2" font="mono">
          {release.version}
        </Txt>
        <Txt color="textMuted" variant="meta">
          {release.day} · {release.size}
        </Txt>
        <Row gap={8} mt={4} wrap>
          <Button
            variant={primary ? 'primary' : 'outline'}
            size="sm"
            href={release.spk}
            label="Download"
          />
          <NotesAction release={release} />
        </Row>
      </Column>
    </Box>
  );
}
