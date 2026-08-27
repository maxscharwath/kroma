import { Children, isValidElement, type ReactNode, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { CONTROL } from '#ui/lib/field-shell';
import { FocusColumn, FocusRegion } from '#ui/lib/focus-scope';
import { stepShape, useStepperPart } from './stepper-context';

function stepValueOf(node: ReactNode): string | undefined {
  if (!isValidElement(node)) return undefined;
  return (node.props as { value?: string }).value;
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

  // Stops at the ends rather than wrapping the way <SegmentGroup> does: a
  // sequence has a first step and a last one.
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

export type { StepperListProps };
export { List };
