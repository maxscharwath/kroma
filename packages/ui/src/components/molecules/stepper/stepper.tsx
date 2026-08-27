import { Activity, Children, isValidElement, type ReactNode, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { Button } from '#ui/components/atoms/button';
import { CONTROL, type ControlSize, entryDefaultSize } from '#ui/lib/field-shell';
import {
  Context,
  type StepperOrientation,
  type StepperState,
  type StepperStep,
  useStepperPart,
} from './stepper-context';
import { Hint, Item, Label, type StepperItemProps } from './stepper-item';
import { List, type StepperListProps } from './stepper-list';
import { type StepperValueDetails, useSteps } from './use-steps';

function numberedStep({ position, count, title, complete }: StepperStep): string {
  const at = `Étape ${position} sur ${count}`;
  const named = title ? `${at} : ${title}` : at;
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

interface StepperRootProps {
  /** Present: you own the step being shown (controlled). Absent: the flow runs
   *  itself from `defaultValue` and reports through `onValueChange`. */
  value?: string;
  /** Where the flow opens, defaulting to the first step. It also seeds how far
   *  the flow counts as having been. */
  defaultValue?: string;
  onValueChange?: (next: string, details: StepperValueDetails) => void;
  /** The steps that are done, for a flow whose owner decides that. Left out, a
   *  step is done once the flow has been past it, and a step ahead of its
   *  furthest point cannot be gone to. */
  complete?: readonly string[];
  /** Names the indicator to assistive tech: what is being stepped through. */
  label: string;
  /** Defaults to `horizontal`. */
  orientation?: StepperOrientation;
  /** The control shell's size; see <TextField>. */
  size?: ControlSize;
  /** The accessible name of one step, defaulting to `Étape 2 sur 4 : Compte`
   *  with `, terminée` on a step the flow is past. */
  stepLabel?: (step: StepperStep) => string;
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
  const state: StepperState = { flow, size: shell, orientation, label, stepLabel };
  return (
    <Context.Provider value={state}>
      <Box gap={CONTROL[shell].gap} style={style}>
        {children}
      </Box>
    </Context.Provider>
  );
}

interface StepperPanelProps {
  value: string;
  /** Keep the panel mounted while another step is showing, so what was typed in
   *  it is still there on the way back. Hidden through `<Activity>`: its effects
   *  stop and it leaves the tab order and the D-pad ring. Defaults to false. */
  keepMounted?: boolean;
  children?: ReactNode;
}

/** Only the step being shown draws a panel. */
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

interface StepperMoveProps {
  /** The word on the button, which is also its accessible name. Defaults to
   *  `Précédent` and `Suivant`. */
  label?: string;
  /** The ends of the flow already disable themselves. */
  disabled?: boolean;
}

function Previous({ label = 'Précédent', disabled = false }: Readonly<StepperMoveProps>) {
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

function Next({ label = 'Suivant', disabled = false }: Readonly<StepperMoveProps>) {
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

export type { StepperItemState, StepperOrientation, StepperStep } from './stepper-context';
export { useStepper, useStepperItem } from './stepper-context';
export { stepperVariants } from './stepper-item';
export type { StepperFlow, StepperFlowOptions, StepperValueDetails } from './use-steps';
export { useSteps } from './use-steps';
export type {
  StepperItemProps,
  StepperListProps,
  StepperMoveProps,
  StepperPanelProps,
  StepperRootProps,
};
export { Stepper };
