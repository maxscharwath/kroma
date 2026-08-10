import { CopyAction } from '#site/components/copy-action';
import { MONO } from '#site/lib/ui';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Txt } from '#ui/components/atoms/text';

export interface RegistryUrlProps {
  url: string;
  note: string;
}

export function RegistryUrl({ url, note }: Readonly<RegistryUrlProps>) {
  return (
    <Column gap={12}>
      <Txt variant="overline" color="accentText">
        URL du registre
      </Txt>
      <Box bg="surface1" p={16} radius="lg">
        <Row gap={12} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt style={MONO}>{url}</Txt>
          <CopyAction value={url} />
        </Row>
      </Box>
      <Txt color="textDim" variant="meta">
        {note}
      </Txt>
    </Column>
  );
}
