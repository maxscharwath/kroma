// The one focusable primitive. Every remote-reachable control on every platform
// is this component.
//
// It is a node of the SPATIAL NAVIGATOR (react-tv-space-navigation, built on the
// BBC's LRUD), not a natively focusable view, and that distinction is the whole
// reason the remote behaves. A television's own focus engine picks the next
// control by distance, re-resolves while a scroll view animates, and treats a
// focus guide as a candidate in every direction: Down from a hero button lands
// on the second tile instead of the one beneath it, Up comes back to a different
// button than the one you left, and a press with no target teleports you to the
// top of the screen. All of that was measured on an Apple TV, and none of it is
// configurable.
//
// The navigator decides instead, from the tree: a row is a row because it is
// declared as one, so Up and Down move between rows and Left and Right within
// one. The same engine runs on Apple TV, Android TV, Tizen, webOS and the
// desktop shell, so there is one behaviour to reason about rather than two.
//
// Ring and scale are applied to the SAME element, because a box-shadow scales
// with its element's transform: ring one view but scale a child and the amber
// outline would visibly detach from the artwork it is meant to outline.

import {
  type ComponentProps,
  type ComponentRef,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  type View,
  type ViewStyle,
} from 'react-native';
import {
  DefaultFocus,
  SpatialNavigationFocusableView,
  type SpatialNavigationNodeRef,
} from 'react-tv-space-navigation';
import { splitBoxLayers } from '../../lib/box-layers';
import type { Crossings } from '../../lib/focus-crossings';
import { useRevealOnFocus } from '../../lib/focus-scroll';
import { useFocusScale } from '../../lib/focus-transition';
import { inputHeld } from '../../lib/input-gate';
import { markFocus } from '../../lib/perf';
import { pressGuardActive } from '../../lib/press-guard';
import { ring } from '../../lib/tokens';

/** The browser targets (Tizen, webOS, desktop) resolve react-native to
 * react-native-web. */
const WEB = Platform.OS === 'web';

/** The navigator's `style` type follows whichever react-native copy the consuming
 * app resolves (the tvos fork on a TV, mainline on the phone), and those two are
 * not assignable to each other. Flatten once, here. */
type NavigatorStyle = ComponentProps<typeof SpatialNavigationFocusableView>['style'];
const flat = (style: StyleProp<ViewStyle>[]): NavigatorStyle =>
  StyleSheet.flatten(style) as NavigatorStyle;

/** Same story for the props the navigator spreads onto its view, which is also
 * where this file smuggles a `ref` in - see the call site. */
type NavigatorViewProps = ComponentProps<typeof SpatialNavigationFocusableView>['viewProps'];

interface FocusState {
  focused: boolean;
  pressed: boolean;
}

interface FocusableProps {
  onPress?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Declare this the screen's entry point: where focus lands when it opens. */
  autoFocus?: boolean;
  disabled?: boolean;
  /** Scale while focused. The design uses 1.06 for rail tiles, 1.05 for posters
   *  and 1.04 for the primary action; 1 (the default) means "ring only". */
  focusScale?: number;
  /** Draw the signature amber ring while focused. Turn off for controls that
   *  ring an inner element instead (a cast face rings its avatar, not the card). */
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Merged on top of `style` while focused. */
  focusedStyle?: StyleProp<ViewStyle>;
  children?: ReactNode | ((state: FocusState) => ReactNode);
  /** Accessibility label; also the tvOS VoiceOver name. */
  label?: string;
  /**
   * Accepted for the handful of crossings a layout cannot express. The navigator
   * derives movement from the tree, so this is almost never needed; it is kept
   * so a screen with a genuinely unusual shape has somewhere to say so.
   */
  neighbours?: Crossings;
  ref?: Ref<ComponentRef<typeof View>>;
}

function Focusable({
  onPress,
  onFocus,
  onBlur,
  autoFocus,
  disabled = false,
  focusScale = 1,
  ring: showRing = true,
  style,
  focusedStyle,
  children,
  label,
}: Readonly<FocusableProps>) {
  const [focused, setFocused] = useState(false);
  const animated = useFocusScale(focused, focusScale);

  // The control's own box, and the fallback the page scrolls to when this
  // control is in no row of its own (a settings list, a grid cell). It is the
  // navigator's view on every target, and `viewProps` is the only door to it.
  const box = useRef<View>(null);
  const reveal = useRevealOnFocus(box);

  const handleFocus = useCallback(() => {
    markFocus();
    setFocused(true);
    reveal();
    onFocus?.();
  }, [onFocus, reveal]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  // The OK guard lives here rather than in the navigator: this is the single
  // choke point that can swallow the tail of the press that opened the screen,
  // which the remote's key repeat would otherwise deliver to whatever the new
  // screen focused. It is also where a held remote stops - on native, Select
  // reaches a focused control through the platform, not through the navigator,
  // so an overlay cannot keep it out any other way.
  const press = useCallback(() => {
    if (disabled || inputHeld() || pressGuardActive()) return;
    onPress?.();
  }, [disabled, onPress]);

  // `<DefaultFocus>` decides where a screen opens, and it decides it when the
  // tree is first built - which is too early for a control that arrives with its
  // data (the profile list from storage, the hero from the server). Those
  // screens opened with nothing highlighted at all. So the entry ALSO asks for
  // focus itself, once, when it mounts.
  const entry = useRef<SpatialNavigationNodeRef>(null);
  useEffect(() => {
    if (!autoFocus) return;
    // Next tick, not this one: the node registers itself as focusable during the
    // same commit, and asking too early throws "trying to assign focus to a non
    // focusable node". The try/catch covers the screen that is torn down in
    // between - it is a request, never a requirement.
    const soon = setTimeout(() => {
      try {
        entry.current?.focus();
      } catch {
        // The screen went away first; whatever is there now keeps the focus.
      }
    }, 0);
    return () => clearTimeout(soon);
  }, [autoFocus]);

  // Native renders the control as two views, so the half of the style that says
  // how the PARENT places this control has to ride on the outer one; the web
  // targets have a single view and keep the style whole. Memoised because the
  // call sites hand down module-level style constants and a television renders
  // hundreds of these.
  const layers = useMemo(() => (WEB ? null : splitBoxLayers(style)), [style]);

  const painted = [
    layers ? layers.face : style,
    focused ? focusedStyle : null,
    showRing && focused ? { boxShadow: ring.focusLift } : null,
    animated,
  ];

  const node = (
    <SpatialNavigationFocusableView
      ref={entry}
      onSelect={press}
      onFocus={handleFocus}
      onBlur={handleBlur}
      // On the browser targets the control is ONE element: the navigator's own
      // view carries the design's box. A television renders hundreds of these,
      // and a second view per control (plus the Pressable that used to wrap it)
      // is a cost Tizen pays on every focus move. The native builds keep the
      // inner view because their focus scale is a real Animated value, so there
      // this view carries the box the parent lays out and the inner one the face.
      style={WEB ? flat(painted) : (layers?.box as NavigatorStyle)}
      // The `ref` rides in with the other view props: React 19 carries one
      // through a spread like any other prop, and this object is spread straight
      // onto the navigator's view.
      viewProps={
        {
          accessibilityRole: 'button',
          accessibilityLabel: label,
          ref: box,
        } as NavigatorViewProps
      }
    >
      {({ isFocused }: { isFocused: boolean }) => {
        const content =
          typeof children === 'function'
            ? children({ focused: isFocused, pressed: false })
            : children;
        if (WEB) return <>{content}</>;
        return (
          <Painted painted={painted} onPress={press}>
            {content}
          </Painted>
        );
      }}
    </SpatialNavigationFocusableView>
  );

  // A disabled control is not a node at all, so the remote walks straight past
  // it rather than stopping on something that does nothing.
  if (disabled) {
    return (
      <Animated.View
        accessibilityRole="button"
        accessibilityLabel={label}
        aria-disabled
        style={[style, animated]}
      >
        {typeof children === 'function' ? children({ focused: false, pressed: false }) : children}
      </Animated.View>
    );
  }
  return autoFocus ? <DefaultFocus>{node}</DefaultFocus> : node;
}

/**
 * The view the kit styles, and the one place a TOUCH is handled.
 *
 * The navigator answers to a remote and, in a browser, to a click - but not to a
 * finger, because it has no reason to: it is a television library. The phone
 * app uses these same components, so on a build that is not a TV the styled view
 * is a Pressable and a tap activates the control. On a television it stays a
 * plain view: anything the platform can focus there swallows the directional
 * presses and the remote goes dead.
 */
function Painted({
  painted,
  onPress,
  children,
}: Readonly<{ painted: StyleProp<ViewStyle>[]; onPress: () => void; children?: ReactNode }>) {
  if (Platform.isTV) return <Animated.View style={painted}>{children}</Animated.View>;
  // A phone: the navigator answers to a remote and to a click, but not to a
  // finger. This is the only place a tap becomes a press.
  return (
    <AnimatedPressable onPress={onPress} style={painted}>
      {children}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type { FocusableProps, FocusState };
export { Focusable };
