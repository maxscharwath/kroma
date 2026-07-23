// The controls panel: one editor per control a story declares.
//
// Every widget here is built from the kit itself, which is the point. Storybook
// renders its controls in a separate React tree with its own design, so the
// panel can only ever be operated with a mouse. These are `Chip`s and
// `TextField`s, so the panel is D-pad navigable and the whole workbench runs on
// an actual television, next to the components it is inspecting.

import { Box } from '../ui/primitives/box';
import { Chip } from '../ui/primitives/chip';
import { Divider } from '../ui/primitives/divider';
import { Txt } from '../ui/primitives/text';
import { TextField } from '../ui/primitives/text-field';
import type { Control, ResolvedControl } from './story';

/** Beyond this many options a row of chips stops being scannable and turns into
 * a wall, so the control becomes a stepper through the list instead. */
const MAX_CHIPS = 8;

interface ControlRowProps {
  name: string;
  control: Control;
  value: unknown;
  onChange: (next: unknown) => void;
}

/** Steps a value forwards and backwards, showing where it currently sits. Used
 * for numbers and for option lists too long to lay out flat. */
function Stepper({
  label,
  onPrev,
  onNext,
}: Readonly<{ label: string; onPrev: () => void; onNext: () => void }>) {
  return (
    <Box row align="center" gap={8}>
      <Chip variant="surface" icon="chevron-left" onPress={onPrev} />
      <Box minW={120} align="center">
        <Txt variant="meta" lines={1}>
          {label}
        </Txt>
      </Box>
      <Chip variant="surface" icon="chevron-right" onPress={onNext} />
    </Box>
  );
}

function SelectControl({
  options,
  value,
  onChange,
}: Readonly<{ options: string[]; value: unknown; onChange: (next: string) => void }>) {
  const current = String(value ?? '');
  if (options.length <= MAX_CHIPS) {
    return (
      <Box row wrap gap={8}>
        {options.map((option) => (
          <Chip
            key={option}
            variant="subtle"
            label={option || 'aucun'}
            active={option === current}
            onPress={() => onChange(option)}
          />
        ))}
      </Box>
    );
  }
  const at = Math.max(0, options.indexOf(current));
  const step = (delta: number) =>
    onChange(options[(at + delta + options.length) % options.length] as string);
  return <Stepper label={current || 'aucun'} onPrev={() => step(-1)} onNext={() => step(1)} />;
}

function NumberControl({
  control,
  value,
  onChange,
}: Readonly<{
  control: Extract<Control, { kind: 'number' }>;
  value: unknown;
  onChange: (next: number) => void;
}>) {
  const current = typeof value === 'number' ? value : control.min;
  const step = (delta: number) => {
    const next = Math.min(control.max, Math.max(control.min, current + delta * control.step));
    // Fractional steps accumulate binary error fast (0.1 + 0.2), and a control
    // reading 0.30000000000000004 undermines the whole panel.
    onChange(Number(next.toFixed(4)));
  };
  return <Stepper label={String(current)} onPrev={() => step(-1)} onNext={() => step(1)} />;
}

function ControlRow({ name, control, value, onChange }: Readonly<ControlRowProps>) {
  return (
    <Box gap={8}>
      <Txt variant="meta" color="textDim">
        {name}
      </Txt>
      {control.kind === 'text' ? (
        <TextField
          value={String(value ?? '')}
          onChange={onChange}
          physicalKeyboard
          py={10}
          radius="md"
          bg="surface2"
          label={name}
          textStyle={TEXT_INPUT}
        />
      ) : null}
      {control.kind === 'boolean' ? (
        <Box row gap={8}>
          {[false, true].map((option) => (
            <Chip
              key={String(option)}
              variant="subtle"
              label={String(option)}
              active={value === option}
              onPress={() => onChange(option)}
            />
          ))}
        </Box>
      ) : null}
      {control.kind === 'select' ? (
        <SelectControl options={control.options} value={value} onChange={onChange} />
      ) : null}
      {control.kind === 'number' ? (
        <NumberControl control={control} value={value} onChange={onChange} />
      ) : null}
    </Box>
  );
}

interface ControlsProps {
  controls: readonly ResolvedControl[];
  args: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

/** The panel. Variants lead, because they are the design's own axes; the plain
 * props that follow are the content you pour into them. */
function Controls({ controls, args, onChange }: Readonly<ControlsProps>) {
  const variants = controls.filter((control) => control.variant);
  const props = controls.filter((control) => !control.variant);
  if (controls.length === 0) {
    return (
      <Txt variant="meta" color="textDim">
        Ce composant n'expose rien à régler.
      </Txt>
    );
  }
  return (
    <Box gap={24}>
      {variants.length > 0 ? (
        <Box gap={16}>
          <Txt variant="overline" color="accent">
            Variantes
          </Txt>
          {variants.map((control) => (
            <ControlRow
              key={control.key}
              name={control.key}
              control={control.control}
              value={args[control.key]}
              onChange={(next) => onChange(control.key, next)}
            />
          ))}
        </Box>
      ) : null}
      {variants.length > 0 && props.length > 0 ? <Divider spacing={0} /> : null}
      {props.length > 0 ? (
        <Box gap={16}>
          <Txt variant="overline" color="accent">
            Props
          </Txt>
          {props.map((control) => (
            <ControlRow
              key={control.key}
              name={control.key}
              control={control.control}
              value={args[control.key]}
              onChange={(next) => onChange(control.key, next)}
            />
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

const TEXT_INPUT = { fontSize: 15, fontWeight: '600' as const };

export type { ControlsProps };
export { ControlRow, Controls, MAX_CHIPS };
