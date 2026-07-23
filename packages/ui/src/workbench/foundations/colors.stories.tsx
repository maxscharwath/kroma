// The palette, as a sheet.
//
// A token list belongs in the workbench for the same reason the components do:
// it is the thing a change lands on first, and reading a hex value in a file
// tells you nothing about whether the two surfaces are far enough apart.

import { colors } from '../../lib/tokens';
import { Box } from '../../ui/primitives/box';
import { Txt } from '../../ui/primitives/text';
import { story } from '../story';

export default story({
  name: 'Couleurs',
  group: 'Fondations',
  docs: 'Chaque token de couleur du design system. La source est packages/ui/src/lib/tokens/colors.ts, qui génère aussi les variables CSS des cibles navigateur.',
  matrix: false,
  render: () => (
    <Box row wrap gap={16} maxW={900}>
      {(Object.keys(colors) as (keyof typeof colors)[]).map((token) => (
        <Box key={token} gap={8} w={150}>
          <Box h={56} radius="md" bg={token} border="border" />
          <Txt variant="meta" color="textMuted">
            {token}
          </Txt>
          <Txt variant="meta" color="textDim">
            {colors[token]}
          </Txt>
        </Box>
      ))}
    </Box>
  ),
});
