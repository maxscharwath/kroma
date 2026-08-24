// The overflow (⋮) menu a poster and a discover/trending card both wear, so the
// two read as the same tile. This owns only the chrome the card should not
// repeat: the round trigger in the art's top-right corner, its reveal on hover
// (held while the menu is open, always up on a touch screen), and the anchored
// panel. The actions themselves differ per card and come in as <Menu.Item>
// children.

import { IconButton, Menu, type MenuTriggerBind } from '@kroma/ui/kit';
import type { ReactNode } from 'react';

function trigger(label: string) {
  return (bind: MenuTriggerBind, { open }: { open: boolean }) => (
    <div className="poster-menu" data-open={open ? '' : undefined}>
      <IconButton
        ref={bind.ref}
        icon="dots-vertical"
        variant="scrim"
        diameter={30}
        glyph={18}
        label={label}
        expanded={bind.expanded}
        onPress={bind.onPress}
      />
    </div>
  );
}

export function PosterActionsMenu({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <Menu.Root label={label} align="end">
      <Menu.Trigger render={trigger(label)} />
      {children}
    </Menu.Root>
  );
}
