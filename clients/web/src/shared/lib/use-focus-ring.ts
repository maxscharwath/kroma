import { type RingToken, useTheme } from '@kroma/ui/kit';
import { type CSSProperties, useMemo, useState } from 'react';

/**
 * The kit's focus ring for an element that cannot be a `<Focusable>`. Spread
 * `bind` on the element and give it `style`, which is `rest` until the element
 * takes focus.
 */
export function useFocusRing(rest: CSSProperties, token: RingToken = 'focus') {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const lit = useMemo(() => ({ ...rest, ...theme.ring[token] }), [rest, theme, token]);
  return {
    style: focused ? lit : rest,
    bind: {
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
    },
  };
}
