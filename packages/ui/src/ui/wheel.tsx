// <Wheel>: the KROMA chromatic wheel, on every target.
//
// The optional rotation is an Animated loop rather than a CSS keyframe: it is
// one native-driven transform, it needs no injected stylesheet, and it settles
// correctly in an occluded window (a keyframe with `fill: both` does not).

import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Path, Svg } from '../lib/svg';
import {
  KROMA_WHEEL_COLORS,
  KROMA_WHEEL_SEGMENTS,
  WHEEL_SPIN_MS,
  WHEEL_VIEWBOX,
  type WheelSpin,
} from '../lib/wheel-paths';

interface WheelProps {
  /** Wheel diameter. */
  size?: number;
  spin?: WheelSpin;
}

function Wheel({ size = 24, spin }: Readonly<WheelProps>) {
  const angle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!spin) return;
    angle.setValue(0);
    const loop = Animated.loop(
      Animated.timing(angle, {
        toValue: 1,
        duration: WHEEL_SPIN_MS[spin],
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin, angle]);

  const svg = (
    <Svg width={size} height={size} viewBox={WHEEL_VIEWBOX}>
      {KROMA_WHEEL_SEGMENTS.map((d, i) => (
        <Path key={d} d={d} fill={KROMA_WHEEL_COLORS[i]} />
      ))}
    </Svg>
  );

  if (!spin) return svg;
  const rotate = angle.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return <Animated.View style={{ transform: [{ rotate }] }}>{svg}</Animated.View>;
}

export type { WheelProps };
export { Wheel };
