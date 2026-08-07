// The web's two presentations of <Menu>'s items. Inside a focus scope the
// dialog presentation stands; unscoped, the items are an anchored panel with
// the menu keyboard: arrows move the active item, Enter fires it, printable
// keys type ahead, Esc returns to the trigger. DOM focus stays on the panel
// and `aria-activedescendant` names the active row.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, type View } from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { Divider } from '#ui/components/atoms/divider';
import { Icon } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';
import { styles } from '#ui/core';
import { type AnchorPlacement, placeUnder } from '#ui/lib/anchor';
import { useInsideFocusScope } from '#ui/lib/focus-presence';
import { Portal } from '#ui/lib/portal';
import type { MenuItem } from './menu';
import { MenuSurfaceDialog, type MenuSurfaceProps, menuItemVariants } from './menu-surface-dialog';

function MenuSurface(props: Readonly<MenuSurfaceProps>) {
  const scoped = useInsideFocusScope();
  if (scoped) return <MenuSurfaceDialog {...props} />;
  return props.open ? <MenuPanel {...props} /> : null;
}

const MIN_WIDTH = 184;
const MAX_HEIGHT = 400;

function element(ref: React.RefObject<View | null>): HTMLElement | null {
  return ref.current as unknown as HTMLElement | null;
}

function MenuPanel({ onClose, label, items, align, anchor }: Readonly<MenuSurfaceProps>) {
  const baseId = useId();
  const panel = useRef<View>(null);
  const rows = items.filter((entry): entry is MenuItem => entry !== 'separator');
  const [at, setAt] = useState<AnchorPlacement | null>(null);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      rows.findIndex((row) => !row.disabled),
    ),
  );
  const typed = useRef({ buffer: '', last: 0 });

  useLayoutEffect(() => {
    const trigger = element(anchor);
    if (!trigger) return;
    const settle = () =>
      setAt(placeUnder(trigger, { minWidth: MIN_WIDTH, maxHeight: MAX_HEIGHT, align }));
    settle();
    window.addEventListener('resize', settle);
    window.addEventListener('scroll', settle, true);
    return () => {
      window.removeEventListener('resize', settle);
      window.removeEventListener('scroll', settle, true);
    };
  }, [anchor, align]);

  useEffect(() => {
    element(panel)?.focus();
    const trigger = element(anchor);
    return () => trigger?.focus();
  }, [anchor]);

  const fire = useCallback(
    (row: MenuItem | undefined) => {
      if (!row || row.disabled) return;
      onClose();
      row.onSelect();
    },
    [onClose],
  );

  const move = (from: number, delta: -1 | 1) => {
    for (let i = from + delta; i >= 0 && i < rows.length; i += delta) {
      if (!rows[i]?.disabled) {
        setActive(i);
        return;
      }
    }
  };

  const typeahead = (key: string) => {
    const now = Date.now();
    const state = typed.current;
    state.buffer = (now - state.last > 500 ? '' : state.buffer) + key.toLowerCase();
    state.last = now;
    const hit = rows.findIndex(
      (row) => !row.disabled && row.label.toLowerCase().startsWith(state.buffer),
    );
    if (hit >= 0) setActive(hit);
  };

  const onKeyDown = (event: { nativeEvent: { key: string }; preventDefault: () => void }) => {
    const key = event.nativeEvent.key;
    if (key === 'ArrowDown') {
      event.preventDefault();
      move(active, 1);
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      move(active, -1);
    } else if (key === 'Home') {
      event.preventDefault();
      move(-1, 1);
    } else if (key === 'End') {
      event.preventDefault();
      move(rows.length, -1);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      fire(rows[active]);
    } else if (key === 'Escape' || key === 'Tab') {
      event.preventDefault();
      onClose();
    } else if (key.length === 1) {
      typeahead(key);
    }
  };

  if (!at) return null;

  let rowIndex = -1;
  return (
    <Portal>
      <Pressable accessibilityLabel="Close" tabIndex={-1} onPress={onClose} style={UNDER} />
      <Box
        ref={panel}
        tabIndex={-1}
        role="menu"
        accessibilityLabel={label}
        aria-activedescendant={`${baseId}-${active}`}
        onKeyDown={onKeyDown}
        radius={12}
        border="borderStrong"
        bg="surface2"
        shadow="pop"
        overflow="hidden"
        p={6}
        style={[PANEL, { left: at.left, top: at.top, minWidth: at.width }]}
      >
        {items.map((entry, index) => {
          if (entry === 'separator') {
            // biome-ignore lint/suspicious/noArrayIndexKey: separators carry no identity
            return <Divider key={`rule-${index}`} spacing={6} />;
          }
          rowIndex += 1;
          const i = rowIndex;
          return (
            <PanelItem
              key={entry.label}
              id={`${baseId}-${i}`}
              item={entry}
              active={i === active}
              onHover={() => setActive(i)}
              onPress={() => fire(entry)}
            />
          );
        })}
      </Box>
    </Portal>
  );
}

function PanelItem({
  id,
  item,
  active,
  onHover,
  onPress,
}: Readonly<{
  id: string;
  item: MenuItem;
  active: boolean;
  onHover: () => void;
  onPress: () => void;
}>) {
  const slots = menuItemVariants({ danger: item.danger ?? false });
  return (
    <Pressable
      nativeID={id}
      role="menuitem"
      accessibilityState={{ disabled: item.disabled }}
      tabIndex={-1}
      onPress={onPress}
      onHoverIn={onHover}
      style={[
        slots.root,
        active && item.danger ? s.activeDanger : null,
        active && !item.danger ? s.active : null,
        item.disabled ? s.disabled : null,
      ]}
    >
      {item.icon ? (
        <Icon name={item.icon} size={15} color={item.danger ? 'danger' : 'text/80'} />
      ) : null}
      <Txt variant="body" style={[slots.ink, s.label]}>
        {item.label}
      </Txt>
    </Pressable>
  );
}

const FIXED = 'fixed' as 'absolute';
const UNDER = { position: FIXED, top: 0, right: 0, bottom: 0, left: 0 } as const;
const PANEL = { position: FIXED, zIndex: 100 } as const;

const s = styles({
  active: { bg: 'white/7' },
  activeDanger: { bg: 'danger/14' },
  disabled: { opacity: 0.4 },
  label: { fontSize: 13, fontWeight: '600' },
});

export { MenuSurface };
