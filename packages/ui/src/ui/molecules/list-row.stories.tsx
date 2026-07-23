import { story } from '../../workbench/story';
import { Box } from '../primitives/box';
import { Switch } from '../primitives/switch';
import { Txt } from '../primitives/text';
import { ListRow, listRowVariants } from './list-row';

export default story({
  name: 'ListRow',
  group: 'Mise en page',
  docs: "Une ligne focusable de menu ou de réglages. Cette forme avait été écrite trois fois avant d'arriver ici: le menu profil du téléviseur, les réglages hors session, et les listes de l'admin.",
  variants: listRowVariants,
  args: { icon: 'settings', label: 'Langue', hint: '' },
  controls: { icon: 'icon' },
  render: ({ hint, ...props }) => (
    <Box w={520}>
      <ListRow {...props} hint={hint || undefined} onPress={() => {}} />
    </Box>
  ),
  scenes: [
    {
      name: 'Une liste',
      render: ({ hint, ...props }) => (
        <Box w={520} gap={10}>
          <ListRow {...props} onPress={() => {}} />
          <ListRow
            icon="language"
            label="Audio"
            hint="Piste par défaut"
            trailing={
              <Txt color="accent" style={{ fontSize: 16, fontWeight: '600' }}>
                Français
              </Txt>
            }
            onPress={() => {}}
          />
          <ListRow
            icon="wave-sine"
            label="Nivellement du volume"
            trailing={<Switch checked onChange={() => {}} />}
          />
          <ListRow icon="logout" label="Se déconnecter" onPress={() => {}} />
        </Box>
      ),
    },
  ],
});
