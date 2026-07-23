import type { IconName } from '../../lib/glyph';
import { story } from '../../workbench/story';
import { Button, buttonVariants } from './button';

export default story({
  name: 'Button',
  group: 'Actions',
  docs: "L'action principale. C'est un Focusable, donc le même composant est un bouton à la souris dans un navigateur et une cible D-pad sur un téléviseur, avec l'anneau ambre et l'échelle de pression du design déjà câblés.",
  variants: buttonVariants,
  args: {
    label: 'Lecture',
    // The empty string is the icon control's "aucun" option, so the type has to
    // admit it even though <Button> does not.
    icon: 'player-play-filled' as IconName | '',
    iconRight: '' as IconName | '',
    disabled: false,
  },
  controls: { icon: 'icon', iconRight: 'icon' },
  render: ({ icon, iconRight, ...props }) => (
    <Button {...props} icon={icon || undefined} iconRight={iconRight || undefined} />
  ),
});
