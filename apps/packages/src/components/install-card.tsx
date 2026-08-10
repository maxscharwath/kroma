import { CopyAction } from '#site/components/copy-action';
import { MONO } from '#site/lib/ui';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Txt } from '#ui/components/atoms/text';

export function InstallCard({ url }: Readonly<{ url: string }>) {
  return (
    <Column gap={12}>
      <Txt variant="overline" color="accentText">
        Install
      </Txt>
      <Txt color="textMuted">
        Package Center → Settings → Package Sources → Add, then paste this URL.
      </Txt>
      <Box bg="surface1" p={16} radius="lg">
        <Row gap={12} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt style={MONO}>{url}</Txt>
          <CopyAction value={url} />
        </Row>
      </Box>
      <Txt color="textDim" variant="meta">
        KROMA shows up in the Community tab and updates itself with every release. Enable beta
        packages to follow the nightly channel.
      </Txt>
    </Column>
  );
}
