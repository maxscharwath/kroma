import { story } from '../../workbench/story';
import { Box } from '../primitives/box';
import { Chip } from '../primitives/chip';
import { Txt } from '../primitives/text';
import { Section } from './section';

export default story({
  name: 'Section',
  group: 'Mise en page',
  docs: 'Une bande titrée: un overline, un filet, et le contenu. Chaque écran de réglages avait sa propre copie de cet arrangement, avec un espacement légèrement différent à chaque fois.',
  matrix: false,
  args: { title: 'Lecture', rule: true, gap: 16 },
  controls: { gap: { min: 0, max: 40, step: 4 } },
  render: (props) => (
    <Box w={520}>
      <Section {...props} action={<Chip variant="subtle" label="Tout voir" />}>
        <Txt color="textMuted">Première ligne de la bande</Txt>
        <Txt color="textMuted">Seconde ligne de la bande</Txt>
      </Section>
    </Box>
  ),
});
