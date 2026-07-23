import { type TypeRole, type as typeRoles } from '../../lib/tokens';
import { story } from '../../workbench/story';
import { Txt } from './text';

const ROLES = Object.keys(typeRoles) as TypeRole[];

export default story({
  name: 'Txt',
  group: 'Fondations',
  docs: "Tout texte du kit passe par ici. La variante nomme un ROLE du design, pas une taille: c'est ce qui permet de retoucher la rampe typographique en un seul endroit.",
  matrix: false,
  args: {
    variant: 'body',
    color: 'text',
    children: 'Le vif zephyr jubile sur les quais',
    lines: 0,
  },
  controls: {
    variant: ROLES,
    color: ['text', 'textMuted', 'textDim', 'accent', 'danger', 'success'],
    lines: { min: 0, max: 4, step: 1 },
  },
  render: ({ children, lines, ...props }) => (
    <Txt {...props} lines={lines || undefined}>
      {children}
    </Txt>
  ),
});
