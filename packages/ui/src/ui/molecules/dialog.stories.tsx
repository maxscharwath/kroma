import { useState } from 'react';
import { story } from '../../workbench/story';
import { Box } from '../primitives/box';
import { Button } from '../primitives/button';
import { Dialog, DialogFooter, type DialogProps } from './dialog';

/** A dialog left permanently open would swallow the workbench's own focus, so
 *  the story ships the trigger that opens it. */
function Demo(props: Readonly<Omit<DialogProps, 'open' | 'onClose' | 'children'>>) {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <Button label="Ouvrir" onPress={() => setOpen(true)} />
      <Dialog {...props} open={open} onClose={() => setOpen(false)}>
        <DialogFooter>
          <Button variant="ghost" label="Annuler" onPress={() => setOpen(false)} />
          <Button variant="danger" label="Supprimer" autoFocus onPress={() => setOpen(false)} />
        </DialogFooter>
      </Dialog>
    </Box>
  );
}

export default story({
  name: 'Dialog',
  group: 'État',
  docs: "Une boîte modale. Elle déclare un SCOPE de focus, ce qui empêche le D-pad de repartir dans la page restée derrière: c'est la difference entre un overlay et une vraie modale sur un téléviseur.",
  matrix: false,
  args: {
    title: 'Supprimer ce profil ?',
    description: 'Cette action est irréversible.',
    width: 520,
  },
  controls: { width: { min: 320, max: 900, step: 20 } },
  render: (props) => <Demo {...props} />,
});
