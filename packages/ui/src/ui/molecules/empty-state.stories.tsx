import { story } from '../../workbench/story';
import { Button } from '../primitives/button';
import { EmptyState } from './empty-state';

export default story({
  name: 'EmptyState',
  group: 'État',
  docs: "L'écran vide: une icône, ce qui manque, et pourquoi. Le variant tv agrandit le tout pour la distance de trois mètres.",
  matrix: false,
  args: {
    icon: 'mood-empty',
    title: 'Aucun résultat',
    hint: 'Essayez un autre terme, ou vérifiez que le serveur est joignable.',
    tv: false,
  },
  controls: { icon: 'icon' },
  render: (props) => <EmptyState {...props} />,
  scenes: [
    {
      name: 'Avec action',
      render: (props) => <EmptyState {...props} action={<Button label="Réessayer" size="sm" />} />,
    },
  ],
});
