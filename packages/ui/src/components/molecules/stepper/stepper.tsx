// <Stepper>: a flow walked one step at a time - an account being set up, a
// television being paired, a file being imported.
//
// A tablist to assistive tech: the indicator is the list, each step is a tab
// carrying its position and its state, and the step being shown claims
// `aria-current="step"`. The Root owns the flow (lib/use-steps), so the two
// buttons, the panels and anything a caller writes with useStepper() all read
// one answer to "where are we".
//
// The order comes from the JSX, the way <SegmentGroup> and <Disclosure> read
// theirs: the Root walks its own children and the list's, so a step is declared
// once, where it is drawn.

import { Activity, Children, isValidElement, type ReactNode, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
import { CONTROL, type ControlSize, entryDefaultSize } from '#ui/lib/field-shell';
import { FocusColumn, FocusRegion } from '#ui/lib/focus-scope';
import {
  Context,
  type StepperOrientation,
  type StepperState,
  type StepperStepName,
  stepShape,
  useStepperPart,
} from './stepper-context';
import { Hint, Item, type StepperItemProps, Label } from './stepper-item';
import { type StepperValueDetails, useSteps } from './use-steps';

function numberedStep({ position, count, name, complete }: StepperStepName): string {
  const at = `Étape ${position} sur ${count}`;
  const named = name ? `${at} : ${name}` : at;
  return complete ? `${named}, terminée` : named;
}

interface Written {
  order: string[];
  disabled: string[];
}

function readSteps(children: ReactNode): Written {
  const written: Written = { order: [], disabled: [] };
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    if (child.type === List) {
      const inner = readSteps((child.props as { children?: ReactNode }).children);
      written.order.push(...inner.order);
      written.disabled.push(...inner.disabled);
      continue;
    }
    if (child.type !== Item) continue;
    const step = child.props as StepperItemProps;
    written.order.push(step.value);
    if (step.disabled) written.disabled.push(step.value);
  }
  return written;
}

function stepValueOf(node: ReactNode): string | undefined {
  if (!isValidElement(node)) return undefined;
  return (node.props as { value?: string }).value;
}

interface StepperRootProps {
  /** Present: you own the step being shown (controlled). Absent: the flow runs
   *  itself from `defaultValue` and reports through `onValueChange`. */
  value?: string;
  /** Where the flow opens, defaulting to the first step. It also seeds how far
   *  the flow counts as having been, so a wizard resumed at step three leaves
   *  the three behind it reachable. */
  defaultValue?: string;
  onValueChange?: (next: string, details: StepperValueDetails) => void;
  /** The steps that are done, for a flow whose owner decides that (a form that
   *  validates). Left out, a step is done once the flow has been past it, and a
   *  step ahead of its furthest point cannot be gone to. */
  complete?: readonly string[];
  /** Names the indicator to assistive tech: what is being stepped through. */
  label: string;
  /** Down a column rather than across a row. Defaults to `horizontal`. */
  orientation?: StepperOrientation;
  /** The control shell's size; see <TextField>. */
  size?: ControlSize;
  /** The accessible name of one step, defaulting to `Étape 2 sur 4 : Compte`
   *  with `, terminée` on a step the flow is past. */
  stepLabel?: (step: StepperStepName) => string;
  /** A `<Stepper.List>`, the `<Stepper.Panel>`s and whatever drives them. The
   *  ORDER is read off this tree, so a step is declared by being drawn. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

function Root({
  value,
  defaultValue,
  onValueChange,
  complete,
  label,
  orientation = 'horizontal',
  size,
  stepLabel = numberedStep,
  children,
  style,
}: Readonly<StepperRootProps>) {
  const shell = size ?? entryDefaultSize();
  const written = useMemo(() => readSteps(children), [children]);
  const flow = useSteps(written.order, {
    value,
    defaultValue,
    onValueChange,
    complete,
    disabled: written.disabled,
  });
  // Left to the React Compiler, which memoises this on the inputs it reads.
  const state: StepperState = { flow, size: shell, orientation, label, stepLabel };
  return (
    <Context.Provider value={state}>
      <Box gap={CONTROL[shell].gap} style={style}>
        {children}
      </Box>
    </Context.Provider>
  );
}

interface StepperListProps {
  /** The steps. Only a DIRECT `<Stepper.Item>` is one, so a step is never
   *  wrapped: the order and the arrow keys are read off this tree. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** The indicator: the steps in order, with the rule between them. */
function List({ children, style }: Readonly<StepperListProps>) {
  const { flow, size, orientation, label } = useStepperPart('List');
  const metrics = CONTROL[size];
  const shape = stepShape(metrics);
  const vertical = orientation === 'vertical';
  const items = useMemo(() => Children.toArray(children).filter(isValidElement), [children]);

  const drawn: ReactNode[] = [];
  for (const [at, child] of items.entries()) {
    if (at > 0) {
      const before = stepValueOf(items[at - 1]);
      drawn.push(
        <Connector
          key={`rule-${at}`}
          vertical={vertical}
          thickness={shape.connector}
          length={shape.step}
          indent={Math.round(metrics.px / 2 + (shape.marker - shape.connector) / 2)}
          complete={before !== undefined && flow.complete(before)}
        />,
      );
    }
    drawn.push(child);
  }

  // A physical keyboard walks the indicator the way a tablist does. It stops at
  // the ends rather than wrapping: a sequence has a first step and a last one,
  // and stepping off either is not a move the flow has.
  const walk = (delta: -1 | 1) => {
    for (let at = flow.index + delta; at >= 0 && at < flow.count; at += delta) {
      const key = flow.steps[at];
      if (key === undefined || !flow.reachable(key)) continue;
      flow.goTo(key);
      return;
    }
  };

  const Group = vertical ? FocusColumn : FocusRegion;
  return (
    <Group>
      <Box
        row={!vertical}
        align={vertical ? 'stretch' : 'center'}
        gap={vertical ? 0 : shape.gap}
        role="tablist"
        accessibilityLabel={label}
        onKeyDown={(event) => {
          const key = event.nativeEvent.key;
          if (key === 'ArrowLeft' || key === 'ArrowUp') walk(-1);
          else if (key === 'ArrowRight' || key === 'ArrowDown') walk(1);
        }}
        style={style}
      >
        {drawn}
      </Box>
    </Group>
  );
}

// The rule between two steps, drawn by the list because only the list knows
// which gap it fills: a step written by hand could not say, and a hand-written
// index is a number the tree already holds.
function Connector({
  vertical,
  thickness,
  length,
  indent,
  complete,
}: Readonly<{
  vertical: boolean;
  thickness: number;
  length: number;
  indent: number;
  complete: boolean;
}>) {
  const paint = complete ? 'accent' : 'border';
  if (vertical) {
    return <Box w={thickness} h={length} ml={indent} radius="pill" bg={paint} aria-hidden />;
  }
  return <Box flex h={thickness} minW={length} radius="pill" bg={paint} aria-hidden />;
}

interface StepperPanelProps {
  value: string;
  /** Keep the panel mounted while another step is showing, so what was typed in
   *  it is still there on the way back. It is hidden through React's
   *  `<Activity>`, which drops the subtree's effects: the panel keeps its state
   *  and still leaves the tab order and the D-pad ring while it is away.
   *  Defaults to false, and a panel that unmounts starts empty every time. */
  keepMounted?: boolean;
  children?: ReactNode;
}

/** The step's own region. Only the step being shown draws one. */
function Panel({ value, keepMounted = false, children }: Readonly<StepperPanelProps>) {
  const { flow, size, stepLabel } = useStepperPart('Panel');
  const active = flow.value === value;
  const at = flow.steps.indexOf(value);
  if (!active && !keepMounted) return null;
  const body = (
    <Box
      role="tabpanel"
      accessibilityLabel={stepLabel({
        position: at + 1,
        count: flow.count,
        complete: flow.complete(value),
      })}
      gap={CONTROL[size].gap}
    >
      {children}
    </Box>
  );
  if (!keepMounted) return body;
  return <Activity mode={active ? 'visible' : 'hidden'}>{body}</Activity>;
}

interface StepperStepProps {
  /** The word on the button, which is also its accessible name. */
  label?: string;
  /** Held back for a reason of the caller's own: a form that has not validated
   *  yet. The ends of the flow already disable themselves. */
  disabled?: boolean;
}

/** The step back, dim rather than gone on the first step. */
function Previous({ label = 'Précédent', disabled = false }: Readonly<StepperStepProps>) {
  const { flow, size } = useStepperPart('Previous');
  return (
    <Button
      variant="ghost"
      size={size}
      icon="chevron-left"
      label={label}
      disabled={disabled || !flow.canGoPrevious}
      onPress={flow.previous}
    />
  );
}

/** The step forward, dim rather than gone on the last step. */
function Next({ label = 'Suivant', disabled = false }: Readonly<StepperStepProps>) {
  const { flow, size } = useStepperPart('Next');
  return (
    <Button
      size={size}
      iconRight="chevron-right"
      label={label}
      disabled={disabled || !flow.canGoNext}
      onPress={flow.next}
    />
  );
}

/**
 * A flow walked one step at a time.
 *
 * ```tsx
 * <Stepper.Root label="Configuration" defaultValue="account">
 *   <Stepper.List>
 *     <Stepper.Item value="account">
 *       <Stepper.Label>Compte</Stepper.Label>
 *       <Stepper.Hint>Adresse et mot de passe</Stepper.Hint>
 *     </Stepper.Item>
 *     <Stepper.Item value="library">
 *       <Stepper.Label>Bibliothèque</Stepper.Label>
 *     </Stepper.Item>
 *   </Stepper.List>
 *   <Stepper.Panel value="account">…</Stepper.Panel>
 *   <Stepper.Panel value="library">…</Stepper.Panel>
 *   <Box row gap={12}>
 *     <Stepper.Previous />
 *     <Stepper.Next />
 *   </Box>
 * </Stepper.Root>
 * ```
 */
const Stepper = { Root, List, Item, Label, Hint, Panel, Previous, Next };

export type {
  StepperItemProps,
  StepperListProps,
  StepperPanelProps,
  StepperRootProps,
  StepperStepProps,
};
export type {
  StepperItemState,
  StepperOrientation,
  StepperStepName,
} from './stepper-context';
export { useStepper, useStepperItem } from './stepper-context';
export { stepperVariants } from './stepper-item';
export type { StepperFlow, StepperFlowOptions, StepperValueDetails } from './use-steps';
export { useSteps } from './use-steps';
export { Stepper };
