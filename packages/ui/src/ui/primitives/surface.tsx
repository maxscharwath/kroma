// <Surface>: a raised panel.
//
// Screens kept spelling out `bg="surface1" radius="lg" border="border" p={20}`,
// which is three token lookups and a magic number every time a card is needed.
// Naming the combinations makes the elevation ladder a design decision the kit
// owns rather than something each screen re-derives.

import type { ReactNode } from 'react';
import { sv } from '../../lib/sv';
import { colors, radius, shadow } from '../../lib/tokens';
import { Box, type BoxProps } from './box';

const surfaceVariants = sv({
  base: { borderRadius: radius.lg },
  variants: {
    tone: {
      /** The default card: one step up from the page. */
      plain: { backgroundColor: colors.surface1 },
      /** Two steps up, for a panel sitting ON a card. */
      raised: { backgroundColor: colors.surface2 },
      /** No fill, just an edge. For grouping without adding weight. */
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.border,
      },
      /** Over artwork, where a solid fill would hide the image. */
      glass: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: colors.borderStrong,
      },
    },
    pad: {
      none: {},
      sm: { padding: 12 },
      md: { padding: 20 },
      lg: { padding: 28 },
    },
    elevated: {
      // `shadow.card` is a CSS box-shadow string; React Native 0.76+ takes it
      // through the `boxShadow` style, which is how <Box> applies it too.
      true: { boxShadow: shadow.card },
      false: {},
    },
  },
  defaults: { tone: 'plain', pad: 'md', elevated: 'false' },
});

type SurfaceTone = 'plain' | 'raised' | 'outline' | 'glass';
type SurfacePad = 'none' | 'sm' | 'md' | 'lg';

interface SurfaceProps extends Omit<BoxProps, 'bg' | 'children'> {
  tone?: SurfaceTone;
  pad?: SurfacePad;
  /** Lift it off the page with the design's card shadow. */
  elevated?: boolean;
  children?: ReactNode;
}

function Surface({
  tone = 'plain',
  pad = 'md',
  elevated = false,
  style,
  children,
  ...box
}: Readonly<SurfaceProps>) {
  return (
    <Box
      {...box}
      style={surfaceVariants({ tone, pad, elevated: elevated ? 'true' : 'false' }, style)}
    >
      {children}
    </Box>
  );
}

export type { SurfacePad, SurfaceProps, SurfaceTone };
export { Surface, surfaceVariants };
