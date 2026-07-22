import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { Icon } from '../../primitives/Icon';
import { Txt } from '../../primitives/Text';
import { Box } from '../../system/Box';
import { colors, motion, radius } from '../../tokens';
import { menuLabel, menuRow, menuRowOff, menuRowOn, menuValue, rowStyle } from './panelStyle';

/**
 * A settings main-menu row: leading icon + label (+ current value), then a
 * chevron (navigates into a sub-view) or an on/off switch (Loop, Statistics).
 * The whole row is the focusable control; a pointer moves D-pad focus, OK/click
 * activates (§15).
 *
 * A bare Pressable rather than a <Focusable>: inside the player the focused row
 * is chosen by the panel's own list navigation (usePlayerNav), not by the screen
 * focus engine, so the row must render the `focused` prop it is given rather
 * than track focus itself.
 */
export function MenuRow({
  icon,
  label,
  value,
  toggle,
  on,
  focused,
  onActivate,
  onFocus,
}: Readonly<{
  icon: ReactNode;
  label: string;
  value?: ReactNode;
  toggle?: boolean;
  on?: boolean;
  focused: boolean;
  onActivate: () => void;
  onFocus: () => void;
}>) {
  return (
    <Pressable
      onPress={onActivate}
      onPointerEnter={onFocus}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={toggle ? { checked: Boolean(on) } : undefined}
      style={rowStyle(menuRow, menuRowOn, menuRowOff, focused)}
    >
      {icon}
      <Box flex style={{ minWidth: 0 }}>
        <Txt style={menuLabel}>{label}</Txt>
        {!toggle && value != null ? <Txt style={menuValue}>{value}</Txt> : null}
      </Box>
      {toggle ? <Switch on={Boolean(on)} /> : <Icon name="chevron-right" size={23} stroke={2.2} />}
    </Pressable>
  );
}

/** The 48x28 track + 22px knob switch used by the Loop / Statistics rows. */
function Switch({ on }: Readonly<{ on: boolean }>) {
  const slide = useRef(new Animated.Value(on ? 1 : 0)).current;
  useEffect(() => {
    const anim = Animated.timing(slide, {
      toValue: on ? 1 : 0,
      duration: motion.duration.base,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [on, slide]);
  const x = slide.interpolate({ inputRange: [0, 1], outputRange: [3, 23] });
  return (
    <Box
      w={48}
      h={28}
      shrink={0}
      radius="pill"
      bg={on ? colors.accent : 'rgba(255, 255, 255, 0.2)'}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 3,
          left: 0,
          width: 22,
          height: 22,
          borderRadius: radius.pill,
          backgroundColor: '#FFFFFF',
          transform: [{ translateX: x }],
        }}
      />
    </Box>
  );
}
