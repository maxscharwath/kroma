import { story } from '../../workbench/story';
import { Spinner } from './spinner';

export default story({
  name: 'Spinner',
  group: 'État',
  docs: "L'indicateur d'attente indéterminé. Animé avec Animated plutôt qu'avec des keyframes CSS, ce qui le rend correct sur les quatre cibles et immunisé contre le gel d'animation d'une fenetre masquée.",
  matrix: false,
  args: { size: 28, thickness: 3 },
  controls: { size: { min: 16, max: 96, step: 4 }, thickness: { min: 1, max: 8, step: 1 } },
  render: (props) => <Spinner {...props} />,
});
