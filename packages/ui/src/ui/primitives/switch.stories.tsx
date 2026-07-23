import { story } from '../../workbench/story';
import { Switch, switchVariants } from './switch';

export default story({
  name: 'Switch',
  group: 'Saisie',
  docs: "L'interrupteur on/off. Un téléviseur n'a pas de gestes: ce n'est pas un pouce que l'on fait glisser mais un Focusable qui bascule sur Select, et la piste se remplit en ambre pour que l'état se lise à trois mètres.",
  variants: switchVariants,
  args: { disabled: false },
  render: (props) => <Switch {...props} checked={false} onChange={() => {}} />,
});
