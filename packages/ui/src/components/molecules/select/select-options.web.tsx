// The web's two presentations of <Select>'s options. Inside a focus scope (a
// TV shell in a browser) the D-pad rules and the dialog presentation stands;
// unscoped - the desktop and phone browser - the options are an anchored
// listbox popover with the combobox keyboard: arrows move the active option,
// Home/End jump, printable keys type ahead, Enter picks, Esc returns to the
// trigger. DOM focus stays on the list and `aria-activedescendant` names the
// active row, so the pattern reads to assistive tech the way it looks.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, type View } from 'react-native';
import { Box } from '#ui/components/atoms/box';
import { Icon } from '#ui/components/atoms/icon';
import { Txt } from '#ui/components/atoms/text';
import { styles } from '#ui/core';
import { type AnchorPlacement, placeUnder } from '#ui/lib/anchor';
import { useInsideFocusScope } from '#ui/lib/focus-presence';
import { Portal } from '#ui/lib/portal';
import type { SelectOption } from './select';
import { optionVariants, SelectOptionsDialog } from './select-options-dialog';
import type { SelectSurfaceProps } from './select-surface';

function SelectOptions(props: Readonly<SelectSurfaceProps>) {
  const scoped = useInsideFocusScope();
  if (scoped) return <SelectOptionsDialog {...props} />;
  return props.open ? <SelectPopover {...props} /> : null;
}

const MIN_WIDTH = 160;
const MAX_HEIGHT = 320;

function element(ref: React.RefObject<View | null>): HTMLElement | null {
  return ref.current as unknown as HTMLElement | null;
}

function place(trigger: HTMLElement): AnchorPlacement {
  return placeUnder(trigger, { minWidth: MIN_WIDTH, matchWidth: true, maxHeight: MAX_HEIGHT });
}

function firstEnabled(options: readonly SelectOption[], value: string): number {
  const chosen = options.findIndex((option) => option.value === value && !option.disabled);
  if (chosen >= 0) return chosen;
  return Math.max(
    0,
    options.findIndex((option) => !option.disabled),
  );
}

function SelectPopover({
  onClose,
  label,
  options,
  value,
  onPick,
  anchor,
}: Readonly<SelectSurfaceProps>) {
  const baseId = useId();
  const list = useRef<View>(null);
  const rows = useRef(new Map<number, number>());
  const [at, setAt] = useState<AnchorPlacement | null>(null);
  const [active, setActive] = useState(() => firstEnabled(options, value));
  const typed = useRef({ buffer: '', last: 0 });

  // Measured before paint so the panel never flashes at 0,0.
  useLayoutEffect(() => {
    const trigger = element(anchor);
    if (!trigger) return;
    const settle = () => setAt(place(trigger));
    settle();
    window.addEventListener('resize', settle);
    // Capture: the scroll that moves the trigger can happen in any container.
    window.addEventListener('scroll', settle, true);
    return () => {
      window.removeEventListener('resize', settle);
      window.removeEventListener('scroll', settle, true);
    };
  }, [anchor]);

  // The list owns the DOM focus while open; the trigger takes it back after.
  useEffect(() => {
    const el = element(list);
    el?.focus();
    const trigger = element(anchor);
    return () => trigger?.focus();
  }, [anchor]);

  // Keep the active row in sight as the keyboard walks the list.
  const scroller = useRef<ScrollView>(null);
  useEffect(() => {
    const y = rows.current.get(active);
    const el = scroller.current as unknown as { getScrollableNode?: () => HTMLElement } | null;
    const node = el?.getScrollableNode?.();
    if (y === undefined || !node) return;
    if (y < node.scrollTop) node.scrollTop = y;
    else if (y + ROW_GUESS > node.scrollTop + node.clientHeight) {
      node.scrollTop = y + ROW_GUESS - node.clientHeight;
    }
  }, [active]);

  const move = useCallback(
    (from: number, delta: -1 | 1) => {
      for (let i = from + delta; i >= 0 && i < options.length; i += delta) {
        if (!options[i]?.disabled) {
          setActive(i);
          return;
        }
      }
    },
    [options],
  );

  const typeahead = (key: string) => {
    const now = Date.now();
    const state = typed.current;
    state.buffer = (now - state.last > 500 ? '' : state.buffer) + key.toLowerCase();
    state.last = now;
    const hit = options.findIndex(
      (option) => !option.disabled && option.label.toLowerCase().startsWith(state.buffer),
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
      move(options.length, -1);
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      const option = options[active];
      if (option && !option.disabled) onPick(option.value);
    } else if (key === 'Escape' || key === 'Tab') {
      event.preventDefault();
      onClose();
    } else if (key.length === 1) {
      typeahead(key);
    }
  };

  if (!at) return null;

  return (
    <Portal>
      {/* The world behind the panel: one press anywhere out there closes it. */}
      <Pressable accessibilityLabel="Close" tabIndex={-1} onPress={onClose} style={UNDER} />
      <Box
        ref={list}
        tabIndex={-1}
        role={LISTBOX}
        accessibilityLabel={label}
        aria-activedescendant={`${baseId}-${active}`}
        onKeyDown={onKeyDown}
        radius={11}
        border="borderStrong"
        bg="surface2"
        shadow="pop"
        overflow="hidden"
        style={[PANEL, { left: at.left, top: at.top, width: at.width }]}
      >
        <ScrollView ref={scroller} style={{ maxHeight: at.maxHeight }}>
          <Box p={6}>
            {options.map((option, index) => (
              <PopoverOption
                key={option.value}
                id={`${baseId}-${index}`}
                option={option}
                chosen={option.value === value}
                active={index === active}
                onHover={() => setActive(index)}
                onPress={() => {
                  if (!option.disabled) onPick(option.value);
                }}
                onLayout={(y) => rows.current.set(index, y)}
              />
            ))}
          </Box>
        </ScrollView>
      </Box>
    </Portal>
  );
}

const ROW_GUESS = 44;

function PopoverOption({
  id,
  option,
  chosen,
  active,
  onHover,
  onPress,
  onLayout,
}: Readonly<{
  id: string;
  option: SelectOption;
  chosen: boolean;
  active: boolean;
  onHover: () => void;
  onPress: () => void;
  onLayout: (y: number) => void;
}>) {
  const slots = optionVariants({ chosen });
  return (
    <Pressable
      nativeID={id}
      role="option"
      accessibilityState={{ selected: chosen, disabled: option.disabled }}
      tabIndex={-1}
      onPress={onPress}
      onHoverIn={onHover}
      onLayout={(event) => onLayout(event.nativeEvent.layout.y)}
      style={[slots.root, active ? s.active : null, option.disabled ? s.disabled : null]}
    >
      {option.icon ? <Icon name={option.icon} size={18} color="textMuted" /> : null}
      <Txt variant="body" lines={1} style={slots.ink}>
        {option.label}
      </Txt>
      <Box flex />
      {option.note ? (
        <Txt variant="meta" color="textDim">
          {option.note}
        </Txt>
      ) : null}
      <Box w={18} align="center">
        {chosen ? <Icon name="check" size={16} color="accent" /> : null}
      </Box>
    </Pressable>
  );
}

// `listbox` reaches the DOM through react-native-web even though React
// Native's `Role` union stops short of it.
const LISTBOX = 'listbox' as import('react-native').Role;

// `position: fixed` - the panel rides the viewport, not a scroll container.
// React Native's types don't know `fixed`, hence the cast.
const FIXED = 'fixed' as 'absolute';

const UNDER = { position: FIXED, top: 0, right: 0, bottom: 0, left: 0 } as const;
const PANEL = { position: FIXED, zIndex: 100 } as const;

const s = styles({
  active: { bg: 'white/8' },
  disabled: { opacity: 0.4 },
});

export { SelectOptions };
