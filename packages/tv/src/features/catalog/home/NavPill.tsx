// The section switcher at the top of every browse screen. The capsule itself -
// the metrics, the amber lens, the travelling ink - now lives in the kit
// (@kroma/ui NavPill), where the iPhone's tab bar draws the same design at
// thumb distance; see the kit story for the whole argument. What stays here is
// this app's shape for it: the section list as DATA, and the focus wiring that
// names the last item as the account avatar's left-hand neighbour.

import { type Crossings, type IconName, NavPill as KitNavPill, NavPillItem } from '@kroma/ui/kit';
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
    <KitNavPill size="tv">
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <NavPillItem
            key={item.key}
            icon={item.icon}
            label={item.label}
            active={item.key === active}
            onPress={item.onPress}
            ref={last ? lastRef : undefined}
            neighbours={last ? lastNeighbours : undefined}
          />
        );
      })}
    </KitNavPill>
  );
}
