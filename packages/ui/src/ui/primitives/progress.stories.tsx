import { story } from '../../workbench/story';
import { Box } from './box';
import { Progress } from './progress';

export default story({
  name: 'Progress',
  group: 'État',
  docs: 'La barre de progression de lecture: celle qui court sous une vignette déjà commencée, et celle du lecteur. La valeur est bornée à 0..1 par le composant lui-même.',
  matrix: false,
  args: { value: 0.42, size: 4, rounded: false },
  controls: { value: { min: 0, max: 1, step: 0.05 }, size: { min: 2, max: 16, step: 1 } },
  render: (props) => (
    <Box w={420}>
      <Progress {...props} />
    </Box>
  ),
});
