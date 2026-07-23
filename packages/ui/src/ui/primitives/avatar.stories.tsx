import { story } from '../../workbench/story';
import { Avatar } from './avatar';
import { Box } from './box';

const NAMES = ['Marie Curie', 'jean.dupont', 'ada_lovelace', 'Alan Turing'];

export default story({
  name: 'Avatar',
  group: 'Marque',
  docs: "Les initiales sur un dégradé choisi de façon déterministe à partir du seed, donc un profil garde ses couleurs d'un appareil à l'autre sans que rien ne soit stocké.",
  matrix: false,
  args: { name: 'Marie Curie', seed: 'a', size: 96, locked: false, shadow: false, radius: 24 },
  controls: { size: { min: 32, max: 200, step: 8 }, radius: { min: 0, max: 999, step: 8 } },
  render: (props) => <Avatar {...props} />,
  scenes: [
    {
      name: 'Une équipe',
      render: (props) => (
        <Box row gap={20} align="center">
          {NAMES.map((name, index) => (
            <Avatar {...props} key={name} name={name} seed={String(index)} />
          ))}
        </Box>
      ),
    },
  ],
});
