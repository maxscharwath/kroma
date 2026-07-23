import type { WheelSpin } from '../../lib/wheel-paths';
import { story } from '../../workbench/story';
import { Wheel } from './wheel';

export default story({
  name: 'Wheel',
  group: 'Marque',
  docs: "La roue chromatique seule, le O de KROMA. Elle sert aussi d'indicateur de chargement de marque a l'ouverture des applications.",
  matrix: false,
  args: { size: 96, spin: 'none' as WheelSpin },
  controls: { size: { min: 24, max: 240, step: 8 }, spin: ['none', 'once', 'loop'] },
  render: (props) => <Wheel {...props} />,
});
