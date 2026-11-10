import { useMemo, useRef, useState } from 'react';
import { Animated, type GestureResponderEvent, type LayoutChangeEvent, type View, type ViewStyle } from 'react-native';

// iOS 27's glass under a finger, from the web version's recordings (src/internal/press.ts): it
// grows until its longer side is about 16 points bigger, follows the finger a little and stretches
// toward it, lights its rim and glows faintly where it's touched, then bounces back past its resting
// size when let go.

/** How many points the longer side grows while pressed. */
const GROW = 16;
const PRESS = { stiffness: 795, damping: 38, mass: 1 };
const RELEASE = { stiffness: 342, damping: 13.5, mass: 1 };

export interface Press {
  /** The transform to put on what's pressed. */
  transform: Animated.WithAnimatedValue<NonNullable<ViewStyle['transform']>>;
  /** Whether a finger is on it, to light its rim. */
  held: boolean;
  /** Where the finger is, in points from its top left, for the glow. */
  touch: { x: number; y: number } | null;
  handlers: {
    onLayout: (event: LayoutChangeEvent) => void;
    onTouchStart: (event: GestureResponderEvent) => void;
    onTouchMove: (event: GestureResponderEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
  // Typed loosely so it fits both a plain view and an animated one.
  ref: React.RefObject<any>;
}

export function usePress(enabled = true, onLayout?: (event: LayoutChangeEvent) => void): Press {
  const values = useRef([1, 1, 0, 0].map((value) => new Animated.Value(value))).current;
  const ref = useRef<View | null>(null) as React.RefObject<any>;
  const size = useRef({ width: 0, height: 0 });
  const origin = useRef<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [held, setHeld] = useState(false);
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null);

  return useMemo(() => {
    const to = (next: number[], feel: typeof PRESS) =>
      Animated.parallel(
        values.map((value, i) => Animated.spring(value, { toValue: next[i]!, ...feel, useNativeDriver: true })),
      ).start();

    const track = (pageX: number, pageY: number) => {
      const { width, height } = size.current;
      const from = start.current;
      if (!from || !width || !height) return;
      if (origin.current) setTouch({ x: pageX - origin.current.x, y: pageY - origin.current.y });
      const base = 1 + GROW / Math.max(width, height);
      const aspect = width / height;
      const dx = (pageX - from.x) / aspect;
      const dy = pageY - from.y;
      const length = Math.hypot(dx, dy);
      if (!length) return to([base, base, 0, 0], PRESS);
      const nx = dx / length;
      const ny = dy / length;
      const rubber = 1 - 1 / (1 + length / height / (5 * aspect));
      const stretch = 1 + (6 / height) * rubber * Math.abs(Math.abs(nx) - Math.abs(ny));
      const across = Math.abs(nx) > Math.abs(ny);
      to([base * (across ? stretch : 1 / stretch), base * (across ? 1 / stretch : stretch), nx * 8 * rubber, ny * 8 * rubber], PRESS);
    };

    const end = () => {
      if (!start.current) return;
      start.current = null;
      setHeld(false);
      setTouch(null);
      to([1, 1, 0, 0], RELEASE);
    };

    return {
      transform: [{ scaleX: values[0]! }, { scaleY: values[1]! }, { translateX: values[2]! }, { translateY: values[3]! }],
      held,
      touch,
      ref,
      handlers: {
        onLayout: (event: LayoutChangeEvent) => {
          size.current = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
          onLayout?.(event);
        },
        onTouchStart: (event: GestureResponderEvent) => {
          if (!enabled || start.current) return;
          const { pageX, pageY, locationX, locationY } = event.nativeEvent;
          start.current = { x: pageX, y: pageY };
          // Where the glass is on the page, for where on it the finger is: the touch may land on
          // its label, so it's measured rather than taken from the touch.
          origin.current = { x: pageX - locationX, y: pageY - locationY };
          ref.current?.measure((_x: number, _y: number, _w: number, _h: number, left: number, top: number) => {
            origin.current = { x: left, y: top };
          });
          setHeld(true);
          track(pageX, pageY);
        },
        onTouchMove: (event: GestureResponderEvent) => track(event.nativeEvent.pageX, event.nativeEvent.pageY),
        onTouchEnd: end,
        onTouchCancel: end,
      },
    };
  }, [enabled, held, touch, onLayout, values]);
}
