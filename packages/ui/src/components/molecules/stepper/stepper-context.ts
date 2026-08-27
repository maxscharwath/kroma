// What a <Stepper.Root> tells its parts, and the two hooks anything inside one
// reads it with.

import type { ControlMetrics, ControlSize } from '#ui/lib/field-shell';
import { partContext } from '#ui/lib/part-context';
import { useStableCallback } from '#ui/lib/stable-callback';
import type { StepperFlow } from './use-steps';

type StepperOrientation = 'horizontal' | 'vertical';

/** What one step is, to whoever names it for assistive tech. */
interface StepperStepName {
  /** One-based, the way it is spoken. */
  position: number;
  count: number;
  /** The step's drawn title, where it has plain text. */
  name?: string;
  complete: boolean;
}

interface StepperState {
  flow: StepperFlow;
  size: ControlSize;
  orientation: StepperOrientation;
  label: string;
  stepLabel: (step: StepperStepName) => string;
}

const [Context, useStepperPart] = partContext<StepperState>('Stepper.Root');

/**
 * The flow the surrounding `<Stepper.Root>` is running, for a footer, a header
 * or a summary the kit's own parts do not draw. Its callbacks keep one identity
 * for the life of the flow.
 */
function useStepper(): StepperFlow {
  return useStepperPart('useStepper').flow;
}

/** One step's own state, for a caller drawing an indicator of its own. */
interface StepperItemState {
  index: number;
  active: boolean;
  complete: boolean;
  /** Whether the flow has been far enough for this step to be gone to. */
  reachable: boolean;
  select: () => void;
}

/** {@link useStepper} for one step of the flow, named by its value. */
function useStepperItem(value: string): StepperItemState {
  const { flow } = useStepperPart('useStepperItem');
  const select = useStableCallback(() => flow.goTo(value));
  return {
    index: flow.steps.indexOf(value),
    active: flow.value === value,
    complete: flow.complete(value),
    reachable: flow.reachable(value),
    select,
  };
}

/** The marker's box, the words' inset and the space between steps, off the one
 *  control table so a stepper wears the same ladder as the fields beside it. */
function stepShape(metrics: ControlMetrics) {
  return {
    marker: metrics.line + 4,
    gap: Math.round(metrics.gap / 2),
    step: metrics.gap,
    connector: 2,
  };
}

export type { StepperItemState, StepperOrientation, StepperState, StepperStepName };
export { Context, stepShape, useStepper, useStepperItem, useStepperPart };
