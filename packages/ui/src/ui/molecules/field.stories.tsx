import { useState } from 'react';
import { story } from '../../workbench/story';
import { Box } from '../primitives/box';
import { TextField } from '../primitives/text-field';
import { Field } from './field';

function Demo({ error, hint, label }: Readonly<{ error?: string; hint?: string; label: string }>) {
  const [value, setValue] = useState('kroma.local:4040');
  return (
    <Box w={420}>
      <Field label={label} hint={hint} error={error}>
        <TextField
          value={value}
          onChange={setValue}
          physicalKeyboard
          py={12}
          radius="md"
          bg="surface2"
          label={label}
          textStyle={{ fontSize: 16, fontWeight: '600' }}
        />
      </Field>
    </Box>
  );
}

export default story({
  name: 'Field',
  group: 'Saisie',
  docs: "Un contrôle étiqueté. La règle que la molécule fait respecter: une erreur REMPLACE l'aide au lieu de s'empiler dessous, parce que deux lignes de petit texte sous un champ, c'est le début d'un formulaire cassé.",
  matrix: false,
  args: { label: 'Adresse du serveur', hint: "Le nom d'hôte ou l'IP, avec le port.", error: '' },
  render: ({ error, ...props }) => <Demo {...props} error={error || undefined} />,
});
