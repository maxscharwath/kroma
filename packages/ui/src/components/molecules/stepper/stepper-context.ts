import type { ControlMetrics, ControlSize } from '#ui/lib/field-shell';
import { partContext } from '#ui/lib/part-context';
import { useStableCallback } from '#ui/lib/stable-callback';
import type { StepperFlow } from './use-steps';

type StepperOrientation = 'horizontal' | 'vertical';

interface StepperStep {
  /** One-based. */
  position: number;
  count: number;
  title?: string;
  complete: boolean;
}

interface StepperState {
  flow: StepperFlow;
  size: ControlSize;
  orientation: StepperOrientation;
  label: string;
  stepLabel: (step: StepperStep) => string;
}

const [Context, useStepperPart] = partContext<StepperState>('Stepper.Root');

/**
 * The flow the surrounding `<Stepper.Root>` is running. Its callbacks keep one
 * identity for the life of the flow.
 */
function useStepper(): StepperFlow {
  return useStepperPart('useStepper').flow;
}

interface StepperItemState {
  index: number;
  active: boolean;
  complete: boolean;
  reachable: boolean;
  select: () => void;
}

/** One step's own state, for a caller drawing an indicator of its own. */
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

function stepShape(metrics: ControlMetrics) {
  return {
    marker: metrics.line + 4,
    gap: Math.round(metrics.gap / 2),
    step: metrics.gap,
    connector: 2,
  };
}

export type { StepperItemState, StepperOrientation, StepperState, StepperStep };
export { Context, stepShape, useStepper, useStepperItem, useStepperPart };
