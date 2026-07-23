// Every glyph the kit ships.
//
// The set is generated from the slugs listed in src/icons/registry.ts, so this
// sheet is also the answer to "do we already have an icon for that".

import { ICON_NAMES } from '../../lib/glyph';
import { Box } from '../../ui/primitives/box';
import { Icon } from '../../ui/primitives/icon';
import { Txt } from '../../ui/primitives/text';
import { story } from '../story';

export default story({
  name: 'Icônes',
  group: 'Fondations',
  docs: "Ajouter une icône: ajoutez son slug Tabler dans src/icons/registry.ts puis lancez bun run icons:gen. Rien d'autre n'est à faire, le rendu DOM et le rendu natif partagent la même donnee.",
  matrix: false,
  args: { size: 26 },
  controls: { size: { min: 12, max: 64, step: 2 } },
  render: ({ size }) => (
    <Box row wrap gap={20} maxW={900}>
      {ICON_NAMES.map((name) => (
        <Box key={name} w={104} align="center" gap={8}>
          <Icon name={name} size={size} />
          <Txt variant="meta" color="textDim" lines={1} style={{ textAlign: 'center' }}>
            {name}
          </Txt>
        </Box>
      ))}
    </Box>
  ),
});
