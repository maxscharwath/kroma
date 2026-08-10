import { CopyAction } from '#site/components/copy-action';
import { MONO } from '#site/lib/ui';
import { Box, Column, Row } from '#ui/components/atoms/box';
import { Txt } from '#ui/components/atoms/text';

export function InstallCard({ url }: Readonly<{ url: string }>) {
  return (
    <Column gap={12}>
      <Txt variant="overline" color="accentText">
        Installation
      </Txt>
      <Txt color="textMuted">
        Centre de paquets → Paramètres → Sources de paquets → Ajouter, puis collez cette URL.
      </Txt>
      <Box bg="surface1" p={16} radius="lg">
        <Row gap={12} style={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Txt style={MONO}>{url}</Txt>
          <CopyAction value={url} />
        </Row>
      </Box>
      <Txt color="textDim" variant="meta">
        KROMA apparaît dans l'onglet Communauté et se met à jour à chaque version. Activez les
        paquets bêta pour suivre le canal nightly.
      </Txt>
    </Column>
  );
}
