import type { IconName } from '../../lib/glyph';
import { story } from '../../workbench/story';
import { Chip, chipVariants } from './chip';

export default story({
  name: 'Chip',
  group: 'Actions',
  docs: "Un filtre ou un choix dans une rangée. L'etat actif est porte par le remplissage ambre, jamais par la seule couleur du texte.",
  variants: chipVariants,
  args: { label: 'Ajoutés', icon: '' as IconName | '' },
  controls: { icon: 'icon' },
  render: ({ icon, ...props }) => <Chip {...props} icon={icon || undefined} />,
});
