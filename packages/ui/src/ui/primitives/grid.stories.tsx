import { story } from '../../workbench/story';
import { PosterCard } from '../molecules/poster-card';
import { Grid } from './grid';

const TINT = ['#3A2E4F', '#1B1524'] as const;

export default story({
  name: 'Grid',
  group: 'Médias',
  docs: "La grille d'affiches. La largeur de cellule est calculée à partir de la largeur mesurée de la rangée, la ou le web se contenterait d'un calc(): c'est ce qui la rend identique sur les quatre cibles.",
  matrix: false,
  width: 1100,
  args: { width: 1000, columns: 5, gap: 24, count: 10 },
  controls: {
    width: { min: 400, max: 1600, step: 50 },
    columns: { min: 2, max: 8, step: 1 },
    gap: { min: 8, max: 48, step: 4 },
    count: { min: 1, max: 24, step: 1 },
  },
  render: ({ count, ...props }) => (
    <Grid {...props}>
      {Array.from({ length: count }, (_, index) => `Affiche ${index + 1}`).map((title, index) => (
        <PosterCard
          key={title}
          title={title}
          art={null}
          tint={TINT}
          watched={index === 2}
          progress={index === 4 ? 0.6 : null}
        />
      ))}
    </Grid>
  ),
});
