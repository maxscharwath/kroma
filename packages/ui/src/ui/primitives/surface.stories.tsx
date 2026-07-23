import { story } from '../../workbench/story';
import { Surface, surfaceVariants } from './surface';
import { Txt } from './text';

export default story({
  name: 'Surface',
  group: 'Mise en page',
  docs: "Le panneau surélevé. Nommer les combinaisons (fond, rayon, bordure, ombre) fait de l'échelle d'élévation une décision du design plutôt qu'un empilement de tokens recopié dans chaque écran.",
  variants: surfaceVariants,
  args: { w: 260 },
  controls: { w: { min: 120, max: 480, step: 20 } },
  render: (props) => (
    <Surface {...props}>
      <Txt variant="meta" color="textMuted">
        Contenu du panneau
      </Txt>
    </Surface>
  ),
});
