import { CopyAction } from '#site/components/copy-action';
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
        Registry URL
      </Txt>
      <Box bg="surface1" p={16} radius="lg">
        <Row gap={12} between>
          <Txt font="mono">{url}</Txt>
          <CopyAction value={url} />
        </Row>
      </Box>
      <Txt color="textDim" variant="meta">
        {note}
      </Txt>
    </Column>
  );
}
