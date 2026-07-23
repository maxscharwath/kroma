import { colors } from '../../lib/tokens';
import { story } from '../../workbench/story';
import { Box } from './box';
import { Focusable } from './focusable';
import { Txt } from './text';

const DEMO = {
  paddingVertical: 16,
  paddingHorizontal: 28,
  borderRadius: 13,
  backgroundColor: colors.surface2,
} as const;

export default story({
  name: 'Focusable',
  group: 'Actions',
  docs: "La seule primitive focalisable du kit. Tout contrôle atteignable à la télécommande en est un, et il porte l'affordance 10-foot: un anneau ambre plein plus une élévation sombre, avec une échelle optionnelle.",
  matrix: false,
  args: { focusScale: 1.06, ring: true, disabled: false },
  controls: { focusScale: { min: 1, max: 1.2, step: 0.02 } },
  render: (props) => (
    <Box row wrap align="center" gap={24}>
      <Focusable {...props} autoFocus label="premier" style={DEMO}>
        <Txt>premier</Txt>
      </Focusable>
      <Focusable {...props} label="deuxieme" style={DEMO}>
        <Txt>deuxieme</Txt>
      </Focusable>
      <Focusable {...props} label="troisieme" style={DEMO}>
        <Txt>troisieme</Txt>
      </Focusable>
    </Box>
  ),
});
