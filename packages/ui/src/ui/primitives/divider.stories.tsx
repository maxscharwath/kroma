import { story } from '../../workbench/story';
import { Box } from './box';
import { Divider } from './divider';
import { Txt } from './text';

export default story({
  name: 'Divider',
  group: 'Mise en page',
  docs: "Un filet. Un pixel physique disparaît sur une dalle 4K vue de loin, d'où une épaisseur réglable plutôt qu'un hairline fixe.",
  matrix: false,
  args: { vertical: false, size: 1, spacing: 12 },
  controls: { size: { min: 1, max: 6, step: 1 }, spacing: { min: 0, max: 40, step: 4 } },
  render: (props) => (
    <Box w={420} row={props.vertical} align="center">
      <Txt variant="meta" color="textDim">
        avant
      </Txt>
      <Divider {...props} />
      <Txt variant="meta" color="textDim">
        après
      </Txt>
    </Box>
  ),
});
