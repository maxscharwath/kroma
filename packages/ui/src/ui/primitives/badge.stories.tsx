import { story } from '../../workbench/story';
import { Badge, type BadgeTone, badgeVariants } from './badge';
import { Box } from './box';

const TONES: BadgeTone[] = ['4K', 'HDR', 'H.265', 'success', 'info', 'neutral'];

export default story({
  name: 'Badge',
  group: 'Actions',
  docs: 'Une pastille de métadonnée: qualité video, codec, etat. Chaque ton a sa couleur dédiée pour rester lisible sur une affiche.',
  variants: badgeVariants,
  args: { tone: '4K' },
  controls: { tone: TONES },
  render: (props) => <Badge {...props} />,
  scenes: [
    {
      name: 'Tous les tons',
      render: (props) => (
        <Box row wrap gap={12} align="center">
          {TONES.map((tone) => (
            <Badge key={tone} {...props} tone={tone} />
          ))}
        </Box>
      ),
    },
  ],
});
