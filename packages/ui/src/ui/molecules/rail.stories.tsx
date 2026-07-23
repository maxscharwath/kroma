import { story } from '../../workbench/story';
import { MediaCard } from './media-card';
import { Rail } from './rail';

const TINT = ['#3A2E4F', '#1B1524'] as const;

export default story({
  name: 'Rail',
  group: 'Médias',
  docs: "Une rangée horizontale défilante. Le défilement suit le focus par décalage mesure plutôt que par scrollIntoView, qui n'existe pas hors du navigateur.",
  matrix: false,
  width: 1100,
  args: { title: 'Reprendre', gap: 24, inset: 0, count: 8 },
  controls: { gap: { min: 8, max: 48, step: 4 }, count: { min: 1, max: 12, step: 1 } },
  render: ({ count, ...props }) => (
    <Rail {...props}>
      {Array.from({ length: count }, (_, index) => `Titre ${index + 1}`).map((title, index) => (
        <MediaCard
          key={title}
          title={title}
          overline="Science-fiction"
          art={null}
          tint={TINT}
          progress={index === 0 ? 0.35 : null}
          watched={index === 1}
        />
      ))}
    </Rail>
  ),
});
