import { story } from '../../workbench/story';
import { tintGradient } from '../molecules/media-card';
import { Box } from './box';
import { Img } from './img';

/** A real remote poster would make the workbench depend on a running server, so
 *  the story leans on the gradient placeholder, which is the interesting part
 *  anyway: it is what the user sees for the first few hundred milliseconds. */
const TINT = tintGradient(['#3A2E4F', '#1B1524']);

export default story({
  name: 'Img',
  group: 'Médias',
  docs: "Toute illustration passe par ici. Le composant possède le dégradé instantané, le fondu au chargement et le fondu croisé quand la source change; le décodeur lui-même est injectable, ce qui laisse l'app mobile utiliser expo-image sans toucher au design.",
  matrix: false,
  args: { src: '', fit: 'cover', radius: 13, duration: 400 },
  controls: {
    fit: ['cover', 'contain'],
    radius: { min: 0, max: 40, step: 1 },
    duration: { min: 0, max: 1200, step: 100 },
  },
  render: ({ src, ...props }) => (
    <Box w={320} h={180}>
      <Img {...props} src={src || null} background={TINT} />
    </Box>
  ),
});
