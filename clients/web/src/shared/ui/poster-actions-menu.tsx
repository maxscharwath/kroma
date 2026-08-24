// The overflow (⋮) menu a poster and a discover/trending card both wear, so the
// two read as the same tile. It owns only the chrome the card should not repeat:
// the glass trigger pinned to the art's top-right (hidden until the frame is
// hovered or focused) and the anchored panel. It is a compound component: a card
// composes its own rows as children with `PosterActionsMenu.Item` and
// `PosterActionsMenu.Separator`, so the action SET is spelled in the card while
// the chrome stays here.

import { IconButton, Menu, type MenuTriggerBind } from '@kroma/ui/kit';
import type { ReactNode } from 'react';

function trigger(label: string) {
  return (bind: MenuTriggerBind, { open }: { open: boolean }) => (
    <div className="poster-menu" data-open={open ? '' : undefined}>
      <IconButton
        ref={bind.ref}
        icon="dots-vertical"
        variant="glass"
        diameter={32}
        glyph={18}
        label={label}
        expanded={bind.expanded}
        onPress={bind.onPress}
      />
    </div>
  );
}

function PosterActionsMenu({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <Menu.Root label={label} align="end">
      <Menu.Trigger render={trigger(label)} />
      {children}
    </Menu.Root>
  );
}

PosterActionsMenu.Item = Menu.Item;
PosterActionsMenu.Separator = Menu.Separator;

export { PosterActionsMenu };
