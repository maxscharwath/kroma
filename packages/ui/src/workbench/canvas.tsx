// The canvas: where the component being inspected actually renders.
//
// Two things happen here that a plain gallery cannot do. The story renders
// inside a real VIEWPORT, so a component can be seen at the size the target
// gives it (a 1920x1080 television, a phone) rather than at whatever size the
// browser window happens to be. And the variant MATRIX is derived from the
// component's `sv`, so every option of every axis is on screen at once, and a
// variant added to the component appears here without anyone writing it down.

import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { ScrollView } from 'react-native';
import { CANVAS, type ColorToken, colors } from '../lib/tokens';
import { Box } from '../ui/primitives/box';
import { Txt } from '../ui/primitives/text';
import type { MatrixRow } from './story';

/** The frames a story can be viewed in. `fit` is the honest default: most
 * primitives are sized by their content and a device frame just adds letterbox. */
const VIEWPORTS = {
  fit: null,
  tv: { width: CANVAS.width, height: CANVAS.height },
  phone: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
} as const;

type ViewportName = keyof typeof VIEWPORTS;

/** Backgrounds worth checking a component against. A scrim that reads on the
 * page can vanish on a card, and that is a real bug the gallery used to hide. */
const SURFACES: ColorToken[] = ['bg', 'surface1', 'surface2'];

interface ViewportFrameProps {
  viewport: ViewportName;
  surface: ColorToken;
  pad: number;
  width?: number;
  children: React.ReactNode;
}

/** Renders children inside the chosen device frame, scaled to fit the space
 * available. Scaling is around the centre, exactly as `<TvStage>` does it, so
 * there is no transform-origin to get wrong. */
function ViewportFrame({ viewport, surface, pad, width, children }: Readonly<ViewportFrameProps>) {
  const [area, setArea] = useState({ width: 0, height: 0 });
  const device = VIEWPORTS[viewport];

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setArea((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
  };

  if (!device) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors[surface] }}
        contentContainerStyle={{ padding: 32 + pad, alignItems: 'flex-start' }}
      >
        <Box w={width}>{children}</Box>
      </ScrollView>
    );
  }

  // Never scale up: a 390pt phone blown up to fill a desktop window would show
  // a design nobody ships.
  const scale = Math.min(
    1,
    area.width ? (area.width - 64) / device.width : 1,
    area.height ? (area.height - 64) / device.height : 1,
  );

  return (
    <Box flex center overflow="hidden" onLayout={onLayout}>
      <Box
        w={device.width}
        h={device.height}
        bg={surface}
        overflow="hidden"
        p={pad}
        style={{ transform: [{ scale }] }}
      >
        {children}
      </Box>
    </Box>
  );
}

interface MatrixProps {
  rows: readonly MatrixRow[];
  args: Record<string, unknown>;
  render: (args: Record<string, unknown>) => React.ReactNode;
}

/**
 * One labelled row per variant group, holding every other axis at its current
 * value. That is deliberately not the full cartesian product: the product of
 * four groups is hundreds of cells nobody reads, whereas one row per axis
 * answers the question actually being asked, which is "what does THIS axis do".
 * The other axes stay live on the controls, so any combination is still one
 * click away.
 */
function Matrix({ rows, args, render }: Readonly<MatrixProps>) {
  if (rows.length === 0) {
    return (
      <Txt variant="meta" color="textDim">
        Ce composant ne déclare pas de variantes.
      </Txt>
    );
  }
  return (
    <Box gap={40}>
      {rows.map((row) => (
        <Box key={row.group} gap={16}>
          <Txt variant="overline" color="accent">
            {row.group}
          </Txt>
          <Box row wrap gap={28} align="flex-start">
            {row.options.map((option) => (
              <Box key={String(option)} gap={10} align="flex-start">
                {render({ ...args, [row.group]: option })}
                <Txt variant="meta" color="textDim">
                  {String(option)}
                </Txt>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export type { MatrixProps, ViewportFrameProps, ViewportName };
export { Matrix, SURFACES, VIEWPORTS, ViewportFrame };
