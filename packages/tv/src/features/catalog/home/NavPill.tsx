// The section switcher at the top of every browse screen, in the shape the
// iPhone app already uses for its bottom tab bar (clients/mobile PillTabBar): a
// floating capsule of icon + label, where the current section sits in its own
// amber lens. One design, two form factors - so a household that uses both apps
// learns the sections once.
//
// The 10-foot difference is that every item keeps its LABEL. The phone hides all
// but the active one because a thumb is already on the glass and the bar has a
// screen's width to fit in; a television has room to spare and a viewer three
// metres away reading, not tapping. Constant labels also mean the capsule never
// changes width, so nothing shifts under the ring as it moves.

import { Box, type Crossings, colors, Focusable, Icon, type IconName, Txt } from '@kroma/ui/kit';
import type { ComponentRef, Ref } from 'react';
import type { View } from 'react-native';

export interface NavItem {
  key: string;
  label: string;
  icon: IconName;
  onPress: () => void;
}

/** The capsule itself: the items, and nothing about what they mean. */
export function NavPill({
  items,
  active,
  lastRef,
  lastNeighbours,
}: Readonly<{
  items: readonly NavItem[];
  /** Key of the current section, or none on a deep screen (detail / person). */
  active?: string;
  /** Named by the account avatar as its left-hand neighbour. */
  lastRef?: Ref<ComponentRef<typeof View>>;
  lastNeighbours?: Crossings;
}>) {
  return (
    // Solid translucent fill, no backdrop blur: Tizen composites blur on the CPU
    // and it costs visible frames on every scroll / focus move. (The phone gets
    // its BlurView because iOS composites it on the GPU.)
    <Box row align="center" gap={4} p={6} radius="pill" border="borderStrong" bg={PILL_FILL}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <NavPillItem
            key={item.key}
            item={item}
            active={item.key === active}
            ref={last ? lastRef : undefined}
            neighbours={last ? lastNeighbours : undefined}
          />
        );
      })}
    </Box>
  );
}

function NavPillItem({
  item,
  active,
  ref,
  neighbours,
}: Readonly<{
  item: NavItem;
  active: boolean;
  ref?: Ref<ComponentRef<typeof View>>;
  neighbours?: Crossings;
}>) {
  return (
    <Focusable
      ref={ref}
      neighbours={neighbours}
      onPress={item.onPress}
      label={item.label}
      focusScale={1.04}
      style={active ? ITEM_ACTIVE : ITEM}
      focusedStyle={active ? null : FOCUSED}
    >
      {({ focused }) => {
        const ink = inkOf(active, focused);
        return (
          <>
            <Icon name={item.icon} size={26} stroke={1.9} color={ink} />
            <Txt style={LABEL} color={ink}>
              {item.label}
            </Txt>
          </>
        );
      }}
    </Focusable>
  );
}

/** The current section is amber; an idle one recedes, and comes up to full ink
 * under the ring. Icon and label always take the same ink, so an item reads as
 * one object rather than a glyph next to a word. */
function inkOf(active: boolean, focused: boolean): string {
  if (active) return colors.accentBright;
  return focused ? colors.text : colors.textMuted;
}

const PILL_FILL = 'rgba(18, 18, 22, 0.78)';

/** One geometry for every state: the box is the same whether the item is idle,
 * focused or current, so only colour moves as the ring travels the bar. */
const ITEM = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 9,
  paddingHorizontal: 18,
  paddingVertical: 11,
  borderRadius: 999,
};

const ITEM_ACTIVE = { ...ITEM, backgroundColor: colors.accentSoft };

const FOCUSED = { backgroundColor: 'rgba(255, 255, 255, 0.10)' };

const LABEL = { fontSize: 18, fontWeight: '700' as const, letterSpacing: 0.2 };
