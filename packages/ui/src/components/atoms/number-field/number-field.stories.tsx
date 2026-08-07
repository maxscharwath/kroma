import { story } from '@kroma/workbench/story';
import { useState } from 'react';
import { Box } from '#ui/components/atoms/box';
import { Txt } from '#ui/components/atoms/text';
import { NumberField } from './number-field';

function Demo({ min, max, step }: Readonly<{ min: number; max: number; step: number }>) {
  const [value, setValue] = useState(4);
  return (
    <Box gap={10}>
      <NumberField
        label="Max tokens"
        value={value}
        onChange={setValue}
        min={min}
        max={max}
        step={step}
      />
      <Txt variant="meta" color="textDim">
        committed: {value}
      </Txt>
    </Box>
  );
}

export default story({
  name: 'NumberField',
  group: 'Input',
  docs: 'A compact numeric entry. The buffer is text - a cleared field can be retyped in peace - but only a real number is ever committed, so a blank can never silently become `0` and sneak under `min`. Commits clamp to `min`/`max`, and on a physical keyboard the **arrow keys step** the value the way a native number input does.',
  usage: `<NumberField label="Max tokens" value={maxTokens} onChange={setMaxTokens} min={1} step={256} />`,
  guidelines: {
    do: [
      'Give it a `label` - the field is usually inside a <Field> row that hides it visually.',
      'State `min`/`max` when the server would reject values outside them.',
    ],
    dont: ["Don't use it for a bounded handful of values - that is a <SegmentedControl>."],
  },
  matrix: false,
  args: { min: 0, max: 100, step: 1 },
  controls: { min: 'number', max: 'number', step: 'number' },
  render: ({ min, max, step }) => <Demo min={min} max={max} step={step} />,
});
