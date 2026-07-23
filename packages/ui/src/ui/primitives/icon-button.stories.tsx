import { story } from '../../workbench/story';
import { IconButton, iconButtonVariants } from './icon-button';

export default story({
  name: 'IconButton',
  group: 'Actions',
  docs: "Un bouton carré sans texte, pour les barres d'outils du lecteur. Le label reste obligatoire: il ne s'affiche pas mais il nomme la commande pour l'accessibilité.",
  variants: iconButtonVariants,
  args: { icon: 'volume', label: 'Volume', size: 44, disabled: false },
  controls: { icon: 'icon', size: { min: 28, max: 72, step: 4 } },
  render: (props) => <IconButton {...props} />,
});
