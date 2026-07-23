import { story } from '../../workbench/story';
import { Box } from './box';
import { Skeleton } from './skeleton';

export default story({
  name: 'Skeleton',
  group: 'État',
  docs: "Le placeholder pulsant d'un contenu qui charge. Il prend les mêmes raccourcis de mise en page que Box, donc il se dimensionne exactement comme ce qu'il remplace.",
  matrix: false,
  args: { w: 220, h: 22 },
  controls: { w: { min: 40, max: 400, step: 20 }, h: { min: 8, max: 200, step: 4 } },
  render: (props) => (
    <Box gap={12}>
      <Skeleton {...props} />
      <Skeleton {...props} radius="pill" />
    </Box>
  ),
});
