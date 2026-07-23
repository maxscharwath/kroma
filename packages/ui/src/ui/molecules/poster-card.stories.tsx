import { story } from '../../workbench/story';
import { PosterCard } from './poster-card';

const TINT = ['#3A2E4F', '#1B1524'] as const;

export default story({
  name: 'PosterCard',
  group: 'Médias',
  docs: "L'affiche portrait des grilles de bibliothèque. Meme modèle de focus que la vignette paysage, ratio différent.",
  matrix: false,
  args: { title: 'Dune', progress: 0, watched: false },
  controls: { progress: { min: 0, max: 1, step: 0.05 } },
  render: ({ progress, ...props }) => (
    <PosterCard {...props} progress={progress || null} art={null} tint={TINT} />
  ),
});
