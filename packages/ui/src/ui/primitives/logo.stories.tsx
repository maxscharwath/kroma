import type { WheelSpin } from '../../lib/wheel-paths';
import { story } from '../../workbench/story';
import { Logo } from './logo';

export default story({
  name: 'Logo',
  group: 'Marque',
  docs: "Le lockup KROMA, roue chromatique comprise. C'est la seule copie des chemins vectoriels de la marque dans tout le dépôt: tout ce qui affiche le logo passe par ici.",
  matrix: false,
  args: { size: 48, markOnly: false, spin: 'none' as WheelSpin },
  controls: { size: { min: 16, max: 160, step: 8 }, spin: ['none', 'once', 'loop'] },
  render: (props) => <Logo {...props} />,
});
