import { story } from '../../workbench/story';
import { WatchedBadge } from './watched-badge';

export default story({
  name: 'WatchedBadge',
  group: 'Médias',
  docs: "La pastille << déjà vu >> posée au coin d'une affiche.",
  matrix: false,
  args: { size: 28 },
  controls: { size: { min: 16, max: 64, step: 2 } },
  render: (props) => <WatchedBadge {...props} />,
});
