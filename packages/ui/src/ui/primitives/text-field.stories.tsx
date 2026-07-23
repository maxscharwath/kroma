import { useState } from 'react';
import { story } from '../../workbench/story';
import { Box } from './box';
import { TextField, type TextFieldProps } from './text-field';

/** The field is controlled, so a story that lets you type has to hold the value
 *  somewhere. Doing it in a wrapper keeps the story itself declarative. */
function Live({ value: initial, ...props }: Readonly<Omit<TextFieldProps, 'onChange'>>) {
  const [value, setValue] = useState(initial);
  return (
    <Box w={480}>
      <TextField {...props} value={value} onChange={setValue} />
    </Box>
  );
}

export default story({
  name: 'TextField',
  group: 'Saisie',
  docs: "Le champ texte du kit. Sur un téléviseur il ouvre le clavier à l'écran; là où un vrai clavier existe (navigateur, bureau), physicalKeyboard laisse taper directement.",
  matrix: false,
  args: {
    value: 'Dune',
    placeholder: 'Rechercher',
    icon: 'search',
    physicalKeyboard: true,
    label: 'Rechercher',
  },
  controls: { icon: 'icon' },
  // Remounting on every keystroke would fight the wrapper's own state, so the
  // story key follows only the props that are not the text itself.
  render: ({ value, ...props }) => <Live {...props} value={value} key={props.label} />,
});
