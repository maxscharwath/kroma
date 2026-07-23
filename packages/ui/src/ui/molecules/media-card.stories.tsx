import { story } from '../../workbench/story';
import { MediaCard } from './media-card';

const TINT = ['#3A2E4F', '#1B1524'] as const;

export default story({
  name: 'MediaCard',
  group: 'Médias',
  docs: "La vignette paysage des rangées d'accueil. Elle porte son propre voile pour que le titre reste lisible sur n'importe quelle illustration.",
  matrix: false,
  args: {
    title: 'Blade Runner 2049',
    overline: 'Science-fiction',
    progress: 0.35,
    watched: false,
    width: 320,
  },
  controls: {
    progress: { min: 0, max: 1, step: 0.05 },
    width: { min: 160, max: 480, step: 20 },
  },
  render: (props) => <MediaCard {...props} art={null} tint={TINT} />,
});
