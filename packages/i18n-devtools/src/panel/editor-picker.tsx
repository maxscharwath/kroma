import { Icon, Row, Select, Text } from '@kroma/ui/kit';
import { useEditors } from '../server/editors';

export interface EditorPickerProps {
  /** The editor chosen here, or `null` while the dev server may guess. */
  editor: string | null;
  onEditor: (editor: string | null) => void;
}

const GLYPH = 16;
const GUESS = 'guess';

/** Which editor a file opens in. Absent until the machine running the dev
 *  server reports more than one: with a single editor there is nothing to
 *  choose, and with none there is nothing to open with. */
export function EditorPicker({ editor, onEditor }: Readonly<EditorPickerProps>) {
  const editors = useEditors();
  if (editors.length < 2) return null;

  return (
    <Row align="center" justify="space-between" gap={10}>
      <Row align="center" gap={7}>
        <Icon name="external-link" size={GLYPH} color="textDim" />
        <Text variant="overline" color="textDim">
          Editor
        </Text>
      </Row>
      <Select.Root
        label="Editor"
        placeholder="Guess"
        value={editor ?? GUESS}
        onValueChange={(next) => onEditor(next === GUESS ? null : next)}
      >
        <Select.Trigger size="sm" />
        <Select.Item value={GUESS}>Guess</Select.Item>
        {editors.map(({ id, name }) => (
          <Select.Item key={id} value={id}>
            {name}
          </Select.Item>
        ))}
      </Select.Root>
    </Row>
  );
}
