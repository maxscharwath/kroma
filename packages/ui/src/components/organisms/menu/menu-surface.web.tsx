// The web's two presentations of <Menu>'s items. Inside a focus scope the
// dialog presentation stands; unscoped, the items are an anchored panel with
// the menu keyboard: arrows move the active item, Enter fires it, printable
// keys type ahead, Esc returns to the trigger. DOM focus stays on the panel
// and `aria-activedescendant` names the active row.
//
// In place, not portalled: fixed positioning already escapes clipping, and a
// body portal would sit outside react-native-web's <Modal> focus trap.

import { useCallback, useId, useRef, useState } from 'react';
import { Pressable, ScrollView, type View } from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { Divider } from '#ui/components/atoms/divider';
import { Icon } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';
import { styles } from '#ui/core';
import {
  PANEL_BACKDROP,
  PANEL_SHELL,
  useAnchoredPlacement,
  useListKeys,
  usePanelFocus,
} from '#ui/lib/anchored-panel';
import { useInsideFocusScope } from '#ui/lib/focus-presence';
import { useTDefault } from '#ui/services/i18n';
import type { MenuItem } from './menu';
import { MenuSurfaceDialog, type MenuSurfaceProps, menuItemVariants } from './menu-surface-dialog';

function MenuSurface(props: Readonly<MenuSurfaceProps>) {
  const scoped = useInsideFocusScope();
  if (scoped) return <MenuSurfaceDialog {...props} />;
  return props.open ? <MenuPanel {...props} /> : null;
}

const MIN_WIDTH = 184;
const MAX_HEIGHT = 400;

function MenuPanel({ onClose, label, items, align, anchor }: Readonly<MenuSurfaceProps>) {
  const t = useTDefault();
  const baseId = useId();
  const panel = useRef<View>(null);
  const rows = items.filter((entry): entry is MenuItem => entry !== 'separator');
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      rows.findIndex((row) => !row.disabled),
    ),
  );

  const at = useAnchoredPlacement(anchor, { minWidth: MIN_WIDTH, maxHeight: MAX_HEIGHT, align });
  usePanelFocus(panel, anchor);

  const fire = useCallback(
    (row: MenuItem | undefined) => {
      if (!row || row.disabled) return;
      onClose();
      row.onSelect();
    },
    [onClose],
  );

  const { onKeyDown } = useListKeys({
    count: rows.length,
    active,
    setActive,
    disabledAt: (i) => rows[i]?.disabled === true,
    labelAt: (i) => rows[i]?.label ?? '',
    onPick: (i) => fire(rows[i]),
    onClose,
  });

  if (!at) return null;

  let rowIndex = -1;
  return (
    <>
      <Pressable
        accessibilityLabel={t('common.close')}
        tabIndex={-1}
        onPress={onClose}
        style={PANEL_BACKDROP}
      />
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
        style={[PANEL_SHELL, { left: at.left, top: at.top, bottom: at.bottom, minWidth: at.width }]}
      >
        <ScrollView style={{ maxHeight: at.maxHeight }}>
          <Box p={6}>
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
        </ScrollView>
      </Box>
    </>
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

const s = styles({
  active: { bg: 'white/7' },
  activeDanger: { bg: 'danger/14' },
  disabled: { opacity: 0.4 },
  label: { fontSize: 13, fontWeight: '600' },
});

export { MenuSurface };
