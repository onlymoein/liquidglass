import { requireNativeView } from 'expo';
import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import {
  Animated,
  Image,
  Platform,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
  type AccessibilityActionEvent,
  type ColorValue,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useControllable } from './controllable';
import { Backdrop, FilledGlass, Glass, Lens, SelectionGlass } from './glass';
import { fontFamilyFor } from './font';
import { Icon, bottomInset, hasIcon } from './icon';
import { sayNoDrawing } from './icons';
import { native } from './native';
import { haptic } from './haptics';
import { usePress } from './press';
import { Text } from './text';
import type {
  ButtonProps,
  IconSource,
  SegmentedControlProps,
  SliderProps,
  StepperProps,
  SwitchProps,
  TabBarProps,
} from './types';

// The controls where iOS's own aren't there: on Android, built as iOS 27 builds them, on the
// package's glass, with the sizes, colours and springs the web version measured on iOS. Under a
// finger a thumb swells into a clear lens over its track, as on iOS. On the web, where glass is a
// plain pane, they're the same controls without the bend.

const BLUE = '#0a84ff';
const RED = '#ff3b30';

export function useInk() {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    text: dark ? '#fff' : '#000',
    faint: dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)',
    fill: dark ? 'rgba(120,120,128,0.36)' : 'rgba(120,120,128,0.16)',
    raised: dark ? '#636366' : '#fff',
    /** Behind the selected tab, as iOS 27 lifts it. */
    pill: dark ? 'rgba(0,0,0,0.32)' : 'rgba(120,120,128,0.14)',
    accent: dark ? '#0a84ff' : '#007aff',
    track: dark ? 'rgba(235,235,245,0.3)' : 'rgba(59,59,66,0.3)',
    on: dark ? '#30d158' : '#34c759',
    rail: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    progress: dark ? '#0091ff' : '#0088ff',
    thumb: dark ? 'rgba(255,255,255,0.25)' : '#fff',
    segments: dark ? 'rgba(118,118,128,0.24)' : 'rgba(118,118,128,0.12)',
    stepper: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    separator: dark ? 'rgba(235,235,245,0.16)' : 'rgba(0,0,0,0.1)',
    /** Under a menu item while a finger is on it. */
    highlight: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
    /** A disabled menu item's text. */
    disabled: dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)',
    red: dark ? '#ff453a' : RED,
  };
}

// iOS 27's glass buttons, measured on the iPhone simulator: a text button's height and the room
// either side of its text, and the circle an icon makes on its own.
const heights = { small: 32, regular: 38, large: 52 } as const;
const circles = { small: 34, regular: 40, large: 54 } as const;
const paddings = { small: 10, regular: 11.5, large: 19 } as const;
// SF Symbols stand about 1.4 times as large in a button as these icons are drawn by default, with
// lines about as heavy as they are at the smaller size.
const ICON_SCALE = 0.72;
const ICON_WEIGHT = 0.75;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The springs the web version tuned against iOS 27, as stiffness and damping for a unit mass. */
const spring = (value: Animated.Value, toValue: number, stiffness: number, damping: number) =>
  Animated.spring(value, { toValue, stiffness, damping, mass: 1, useNativeDriver: true });

/** A lens stays up at least this long, so a quick tap still shows it, as on iOS. */
const LENS_MS = 300;

/** How far a held thumb has risen into a lens, from 0 at rest to 1. */
function useLift() {
  const lift = useRef(new Animated.Value(0)).current;
  const raised = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return useMemo(
    () => ({
      lift,
      raise() {
        clearTimeout(timer.current);
        raised.current = Date.now();
        spring(lift, 1, 2000, 80).start();
      },
      lower() {
        clearTimeout(timer.current);
        timer.current = setTimeout(
          () => spring(lift, 0, 600, 49).start(),
          Math.max(0, LENS_MS - (Date.now() - raised.current))
        );
      },
    }),
    [lift]
  );
}

/** Keeps the latest value of something for handlers made once. */
/**
 * Where a view's left edge is on the screen. A touch reports where it is relative to whatever it
 * landed on, which may be a label inside, so a control that needs to know where along it the
 * finger is works it out from the screen instead.
 */
function useLeftEdge() {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const left = useRef(0);
  const measure = () =>
    ref.current?.measure((_x: number, _y: number, _w: number, _h: number, pageX: number) => {
      left.current = pageX;
    });
  return { ref, left, measure };
}

/** Where a finger is on a control, in points from its left, and how far it's come. */
type Point = { x: number; dx: number };
type Following = {
  onStart(point: Point): void;
  onMove?(point: Point): void;
  onEnd(point: Point, cancelled: boolean): void;
};

// On Android a native view follows the finger, and the control's thumb or lens is tied to it
// through the native animation driver, so it moves in the frame the finger does, however busy the
// app's JavaScript is. Elsewhere, and without the native code, JavaScript follows it.
export const NativeTrack: ComponentType<Record<string, unknown>> | null =
  native && Platform.OS === 'android' ? Animated.createAnimatedComponent(requireNativeView('LiquidGlass', 'TrackView')) : null;

/**
 * Follows a finger on a control. `x` and `dx` hold where it is and how far it's come, for the
 * control to draw from; `following` hears where it came down, moves and lifts.
 */
function useTrack(enabled: boolean, following: Following) {
  const x = useRef(new Animated.Value(0)).current;
  const dx = useRef(new Animated.Value(0)).current;
  const edge = useLeftEdge();
  const latest = useLatest({ following, enabled });
  const handlers = useMemo(() => {
    if (NativeTrack) {
      type Event = { nativeEvent: Point & { cancelled?: boolean } };
      return {
        onTrackStart: (event: Event) => latest.current.following.onStart(event.nativeEvent),
        onTrack: Animated.event([{ nativeEvent: { x, dx } }], {
          useNativeDriver: true,
          listener: (event: Event) => latest.current.following.onMove?.(event.nativeEvent),
        }),
        onTrackEnd: (event: Event) => latest.current.following.onEnd(event.nativeEvent, !!event.nativeEvent.cancelled),
      };
    }
    let start = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => latest.current.enabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event: GestureResponderEvent) => {
        start = event.nativeEvent.pageX - edge.left.current;
        edge.measure();
        x.setValue(start);
        dx.setValue(0);
        latest.current.following.onStart({ x: start, dx: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        x.setValue(start + gesture.dx);
        dx.setValue(gesture.dx);
        latest.current.following.onMove?.({ x: start + gesture.dx, dx: gesture.dx });
      },
      onPanResponderRelease: (_, gesture) => latest.current.following.onEnd({ x: start + gesture.dx, dx: gesture.dx }, false),
      onPanResponderTerminate: (_, gesture) => latest.current.following.onEnd({ x: start + gesture.dx, dx: gesture.dx }, true),
    }).panHandlers;
  }, []);
  // Natively, a layer over the control takes the finger, and the control's own view keeps its
  // layout, ref and accessibility; in JavaScript, the control's view takes it.
  const Catcher = NativeTrack;
  const catcher = Catcher ? <Catcher {...handlers} enabled={enabled} style={StyleSheet.absoluteFill} /> : null;
  return { x, dx, edge, handlers: Catcher ? {} : handlers, catcher };
}

/** `value` held between `low` and `high`, worked out by the native driver. */
const held = (value: Animated.AnimatedInterpolation<number> | Animated.AnimatedAddition, low: number, high: number) =>
  high > low ? value.interpolate({ inputRange: [low, high], outputRange: [low, high], extrapolate: 'clamp' }) : value;

function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** A thumb at rest is a white pill; held, it swells into a clear lens over what's under it. */
function Thumb({ lift, radius, shadow }: { lift: Animated.Value; radius: number; shadow?: boolean }) {
  return (
    <>
      <Lens style={[StyleSheet.absoluteFill, { borderRadius: radius }]} split={0.06} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            borderWidth: 0.5,
            borderColor: 'rgba(0,0,0,0.3)',
            opacity: lift,
          },
        ]}
      />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: radius,
            backgroundColor: '#fff',
            opacity: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            elevation: shadow ? 3 : 1,
          },
        ]}
      />
    </>
  );
}

/**
 * Whether a control's style asks it to fill its parent's width. Otherwise it keeps its own size,
 * as iOS's controls do, inside a row of its own: a row keeps it from being stretched by a column,
 * and, unlike pinning it with `alignSelf`, still lets a row it's in centre it, as iOS lines up a
 * row of buttons of different heights.
 */
export function fills(style: StyleProp<ViewStyle>): boolean {
  const flat = StyleSheet.flatten(style) ?? {};
  return flat.width != null || flat.minWidth != null || (flat.flex ?? 0) > 0 || (flat.flexGrow ?? 0) > 0 || flat.alignSelf === 'stretch';
}
const HUG: ViewStyle = { flexDirection: 'row' };

/** Whether there's something to show for this icon: one of the package's drawings, or an image. */
export const hasGlyph = (icon: IconSource | undefined): icon is IconSource => icon != null && (typeof icon !== 'string' || hasIcon(icon));

/** An icon in `color`: the package's drawing for an SF Symbol's name, or the app's own image. */
export function Glyph({ icon, color, size, weight }: { icon: IconSource | undefined; color: ColorValue; size: number; weight?: number }) {
  if (icon == null) return null;
  if (typeof icon !== 'string') {
    return <Image source={icon} resizeMode="contain" style={{ width: size, height: size, tintColor: color }} />;
  }
  if (hasIcon(icon)) return <Icon name={icon} color={color} size={size} weight={weight} />;
  sayNoDrawing(icon);
  return null;
}

export function Button({
  label,
  children,
  icon,
  variant = 'glass',
  size = 'regular',
  destructive,
  tint,
  disabled,
  onPress,
  fontFamily,
  style,
  ...props
}: ButtonProps) {
  const ink = useInk();
  const colour: ColorValue = destructive ? RED : (tint ?? BLUE);
  const filled = variant === 'filled';
  const text = label ?? children;
  const ink2: ColorValue = filled ? '#fff' : destructive || tint ? colour : ink.text;
  const shows = hasGlyph(icon);
  if (typeof icon === 'string' && !shows) sayNoDrawing(icon);
  // An icon on its own makes a circle, as on iOS. Without a drawing for it, its label's first letter.
  const lone = !text;
  const height = lone ? circles[size] : heights[size];
  const fallback = lone && !shows ? (props.accessibilityLabel ?? '').slice(0, 1) : undefined;
  const family = fontFamilyFor(fontFamily);
  // Under a finger the whole button grows and follows it, label and all, as on iOS, rather than
  // dimming.
  const press = usePress(!disabled);
  return (
    <Animated.View style={[HUG, style]}>
      <Animated.View
        ref={press.ref}
        {...press.handlers}
        style={{ flexGrow: fills(style) ? 1 : 0, opacity: disabled ? 0.4 : 1, transform: press.transform }}>
        <Pressable
          {...props}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onPress}
          style={{
            height,
            minWidth: height,
            paddingHorizontal: lone ? 0 : paddings[size],
            borderRadius: height / 2,
            flexDirection: 'row',
            gap: 6,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {!filled && (
            <Glass held={press.held} touch={press.touch} style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]} />
          )}
          {filled && (
            <FilledGlass
              colour={colour}
              held={press.held}
              touch={press.touch}
              style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]}
            />
          )}
          {shows && <Glyph icon={icon} color={ink2} size={Math.round(heights[size] * ICON_SCALE)} weight={ICON_WEIGHT} />}
          {(text || fallback) && (
            <Text style={{ color: ink2, fontSize: size === 'small' ? 15 : 17, fontWeight: '500', fontFamily: family }}>{text ?? fallback}</Text>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const SWITCH_TRAVEL = 22;
/** A held thumb grows from 37 by 24 to 59 by 38.3, as iOS 27's does. */
const THUMB_SWELL = 59 / 37;

export function Switch({ checked, defaultChecked = false, onCheckedChange, disabled, tint, style, ...props }: SwitchProps) {
  const ink = useInk();
  const [value, setChecked] = useControllable(checked, defaultChecked, onCheckedChange);
  const setValue = (next: boolean) => {
    if (next !== value) haptic(next ? 'on' : 'off');
    setChecked(next);
  };
  const latest = useLatest({ value, setValue, disabled });
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;
  const colour = useRef(new Animated.Value(value ? 1 : 0)).current;
  const { lift, raise, lower } = useLift();

  const settle = (on: boolean) => {
    spring(position, on ? 1 : 0, 1000, 80).start();
    // The colour outlasts the thumb's trip.
    spring(colour, on ? 1 : 0, 300, 35).start();
  };
  useEffect(() => settle(value), [value]);

  const from = useRef(0);
  const track = useTrack(!disabled, {
    onStart: () => {
      from.current = latest.current.value ? 1 : 0;
      position.stopAnimation();
      position.setValue(from.current);
      raise();
    },
    onEnd: ({ dx }, cancelled) => {
      lower();
      const moved = Math.abs(dx) >= 4;
      const at = clamp(from.current + dx / SWITCH_TRAVEL, 0, 1);
      // The spring takes over from the finger where the finger left it.
      position.setValue(moved ? at : from.current);
      track.dx.setValue(0);
      if (cancelled) return settle(latest.current.value);
      const next = moved ? at > 0.5 : !latest.current.value;
      if (next !== latest.current.value) latest.current.setValue(next);
      // Wherever the app leaves it: on the new side if it took the change, back if it didn't.
      requestAnimationFrame(() => settle(latest.current.value));
    },
  });
  // Made once: rebuilt, the native driver would start again from JavaScript's copy of where the
  // finger is, which JavaScript never sees move.
  const shown = useMemo(() => held(Animated.add(position, Animated.multiply(track.dx, 1 / SWITCH_TRAVEL)), 0, 1), []);

  return (
    <View
      {...props}
      {...track.handlers}
      accessible
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      onAccessibilityTap={() => !disabled && setValue(!value)}
      collapsable={false}
      style={[{ width: 63, height: 28, opacity: disabled ? 0.35 : 1 }, style]}>
      <Backdrop pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 14, overflow: 'hidden', backgroundColor: ink.track }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tint ?? ink.on, opacity: colour }]} />
      </Backdrop>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 2,
          top: 2,
          width: 37,
          height: 24,
          transform: [
            { translateX: shown.interpolate({ inputRange: [0, 1], outputRange: [0, SWITCH_TRAVEL] }) },
            { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, THUMB_SWELL] }) },
          ],
        }}>
        <Thumb lift={lift} radius={12} />
      </Animated.View>
      {track.catcher}
    </View>
  );
}

export function Slider({
  value,
  defaultValue,
  onValueChange,
  onSlidingComplete,
  min = 0,
  max = 1,
  step = 0,
  disabled,
  tint,
  style,
  ...props
}: SliderProps) {
  const ink = useInk();
  const [current, setValue] = useControllable(value, defaultValue ?? min, onValueChange);
  // A tick on reaching either end, as iOS's slider gives.
  const setCurrent = (next: number) => {
    if (next !== current && (next === min || next === max)) haptic('tick');
    setValue(next);
  };
  const [width, setWidth] = useState(0);
  const span = Math.max(1, width - 37);
  const share = clamp((current - min) / (max - min || 1), 0, 1);
  const progress = useRef(new Animated.Value(share)).current;
  const { lift, raise, lower } = useLift();
  const dragging = useRef(false);
  const latest = useLatest({ current, setCurrent, span, min, max, step, disabled, onSlidingComplete });

  useEffect(() => {
    if (!dragging.current) progress.setValue(share);
  }, [share]);

  // Once it's let go, the thumb shows the app's value: where it was left if the app took the
  // change, back where it was if it didn't.
  const backToApp = () =>
    requestAnimationFrame(() => {
      const { current, min, max } = latest.current;
      spring(progress, clamp((current - min) / (max - min || 1), 0, 1), 1000, 80).start();
    });

  const from = useRef(0);
  const valueAt = (dx: number) => {
    const { span, min, max, step } = latest.current;
    const raw = min + clamp(from.current + dx / span, 0, 1) * (max - min);
    return step > 0 ? Math.min(max, min + Math.round((raw - min) / step) * step) : raw;
  };
  // The app hears the value at most once a frame, however often the finger moves, so a screen
  // that's slow to draw again doesn't fall behind the finger.
  const waiting = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const report = () => {
    frame.current = null;
    const next = waiting.current;
    waiting.current = null;
    if (next != null && next !== latest.current.current) latest.current.setCurrent(next);
  };
  const across = useRef(new Animated.Value(1 / span)).current;
  useEffect(() => across.setValue(1 / span), [span]);
  const track = useTrack(!disabled, {
    onStart: () => {
      const { current, min, max } = latest.current;
      from.current = (current - min) / (max - min || 1);
      progress.stopAnimation();
      progress.setValue(from.current);
      dragging.current = true;
      raise();
    },
    onMove: ({ dx }) => {
      waiting.current = valueAt(dx);
      frame.current ??= requestAnimationFrame(report);
    },
    onEnd: ({ dx }) => {
      dragging.current = false;
      lower();
      const final = valueAt(dx);
      if (frame.current != null) cancelAnimationFrame(frame.current);
      waiting.current = final;
      report();
      const { min, max } = latest.current;
      progress.setValue((final - min) / (max - min || 1));
      track.dx.setValue(0);
      latest.current.onSlidingComplete?.(final);
      backToApp();
    },
  });
  const shown = useMemo(() => held(Animated.add(progress, Animated.multiply(track.dx, across)), 0, 1), []);

  return (
    <View
      {...props}
      {...track.handlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: current }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event: AccessibilityActionEvent) => {
        const by = (step || (max - min) / 10) * (event.nativeEvent.actionName === 'increment' ? 1 : -1);
        setCurrent(clamp(current + by, min, max));
      }}
      collapsable={false}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={[{ height: 40, opacity: disabled ? 0.35 : 1 }, style]}>
      <Backdrop
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, right: 0, top: 17, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: ink.rail }}>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width,
            borderRadius: 3,
            backgroundColor: tint ?? ink.progress,
            transform: [{ translateX: shown.interpolate({ inputRange: [0, 1], outputRange: [18.5 - width, span + 18.5 - width] }) }],
          }}
        />
      </Backdrop>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: 8,
          width: 37,
          height: 24,
          transform: [
            { translateX: shown.interpolate({ inputRange: [0, 1], outputRange: [0, span] }) },
            { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, THUMB_SWELL] }) },
          ],
        }}>
        <Thumb lift={lift} radius={12} shadow />
      </Animated.View>
      {track.catcher}
    </View>
  );
}

export function Stepper({ value, defaultValue, onValueChange, min = 0, max = 100, step = 1, disabled, style, ...props }: StepperProps) {
  const ink = useInk();
  const [current, setValue] = useControllable(value, defaultValue ?? min, onValueChange);
  const setCurrent = (next: number) => {
    if (next !== current) haptic('tick');
    setValue(next);
  };
  const half = (sign: -1 | 1) => {
    const next = clamp(current + sign * step, min, max);
    const off = disabled || next === current;
    const name = sign < 0 ? 'minus' : 'plus';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sign < 0 ? 'Decrement' : 'Increment'}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={() => setCurrent(next)}
        style={({ pressed }) => ({
          width: 46,
          height: 32,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? ink.stepper : 'transparent',
          opacity: off ? 0.3 : 1,
        })}>
        {hasIcon(name) ? <Icon name={name} color={ink.text} size={16} /> : <Text style={{ color: ink.text, fontSize: 20 }}>{sign < 0 ? '−' : '+'}</Text>}
      </Pressable>
    );
  };
  return (
    <View style={[HUG, style]}>
      <View
        {...props}
        style={{ flexDirection: 'row', flexGrow: fills(style) ? 1 : 0, alignItems: 'center', height: 32, borderRadius: 16, backgroundColor: ink.stepper }}>
        {half(-1)}
        <View style={{ width: 1, height: 16, marginHorizontal: -0.5, backgroundColor: ink.separator }} />
        {half(1)}
      </View>
    </View>
  );
}

export function SegmentedControl({ items, value, defaultValue, onValueChange, disabled, fontFamily, style, ...props }: SegmentedControlProps) {
  const ink = useInk();
  const [current, setValue] = useControllable<string | undefined>(
    value,
    defaultValue ?? items[0]?.value,
    onValueChange as ((value: string | undefined) => void) | undefined
  );
  const setCurrent = (next: string | undefined) => {
    if (next !== current) haptic('select');
    setValue(next);
  };
  const [width, setWidth] = useState(0);
  const count = Math.max(1, items.length);
  const segment = width / count;
  const index = Math.max(0, items.findIndex((item) => item.value === current));
  const thumb = useRef(new Animated.Value(index)).current;
  const lens = useRef(new Animated.Value(0)).current;
  const { lift, raise, lower } = useLift();
  const latest = useLatest({ items, segment, width, setCurrent, disabled, index });

  useEffect(() => spring(thumb, index, 500, 40).start(), [index]);

  const track = useTrack(!disabled, {
    onStart: () => {
      // The finger carries the lens; the spring takes it back on release.
      lens.stopAnimation();
      lens.setValue(0);
      raise();
    },
    onEnd: ({ x }, cancelled) => {
      const { items, segment, width, setCurrent } = latest.current;
      lens.setValue(clamp(x, segment / 2, width - segment / 2));
      track.x.setValue(0);
      lower();
      if (cancelled) return;
      const at = clamp(Math.floor(x / (segment || 1)), 0, items.length - 1);
      spring(lens, (at + 0.5) * segment, 500, 40).start();
      const item = items[at];
      if (item && !item.disabled) setCurrent(item.value);
    },
  });
  const edge = track.edge;
  const shownLens = useMemo(() => held(Animated.add(lens, track.x), segment / 2, width - segment / 2), [segment, width]);

  const lensWidth = segment + 21;
  return (
    <View
      {...props}
      {...track.handlers}
      ref={edge.ref}
      accessibilityRole="tablist"
      collapsable={false}
      onLayout={(event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
        edge.measure();
      }}
      style={[{ height: 32, opacity: disabled ? 0.35 : 1 }, style]}>
      <Backdrop pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 16, backgroundColor: ink.segments }]}>
        {width > 0 && (
          <Animated.View
            style={{
              position: 'absolute',
              top: 2,
              bottom: 2,
              left: 2,
              width: segment - 4,
              borderRadius: 14,
              backgroundColor: ink.thumb,
              // Not elevation: on Android that also draws it over the labels.
              borderWidth: 0.5,
              borderColor: 'rgba(0,0,0,0.04)',
              transform: [{ translateX: Animated.multiply(thumb, segment) }],
            }}
          />
        )}
        <View style={[StyleSheet.absoluteFill, { flexDirection: 'row' }]}>
          {items.map((item) => {
            const selected = item.value === current;
            return (
              <View
                key={item.value}
                accessible
                accessibilityRole="tab"
                accessibilityLabel={item.label}
                accessibilityState={{ selected, disabled: item.disabled }}
                onAccessibilityTap={() => !item.disabled && setCurrent(item.value)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, opacity: item.disabled ? 0.35 : 1 }}>
                {!item.label && hasIcon(item.icon) ? (
                  <Icon name={item.icon} color={ink.text} size={18} />
                ) : (
                  <Text numberOfLines={1} style={{ color: ink.text, fontSize: 14, fontWeight: selected ? '500' : '400', fontFamily: fontFamilyFor(fontFamily) }}>
                    {item.label}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </Backdrop>
      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -6,
            left: 0,
            width: lensWidth,
            height: 44,
            opacity: lift,
            transform: [
              { translateX: Animated.subtract(shownLens, lensWidth / 2) },
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
            ],
          }}>
          <Lens style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} zoom={1.08} split={0.08} />
          <View style={[StyleSheet.absoluteFill, { borderRadius: 22, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.25)' }]} />
        </Animated.View>
      )}
      {track.catcher}
    </View>
  );
}

// The tab bar's measurements and motion, from the web version, which fitted them to iOS 27 on
// the iPhone simulator (src/tab-bar.tsx, src/styles/tab-bar.css, src/internal/tab-motion.ts).
const TAB = {
  height: 62,
  /** Round the tabs, inside the bar. */
  padX: 8.5,
  padY: 4,
  /** The selection is this much wider than its tab, so it runs close to the bar's ends. */
  wider: 8,
  pill: 54,
  /** How much the selection grows under a finger: 94 by 54 points becomes about 117 by 73. */
  growX: 21,
  growY: 20,
  /** Under a finger the whole bar swells. */
  barGrow: 0.049,
  /** The tabs in the lens are enlarged about their own middles, and drawn in towards the lens's. */
  zoom: 0.19,
  pull: 0.07,
  /** A quick tap keeps the lens up this long, for the trip. */
  liftMs: 230,
  /** Minimised, as when a page scrolls down: only the current tab's icon, in a capsule. */
  miniWidth: 49,
  miniHeight: 39,
} as const;
// [stiffness, damping]: at rest the selection swings a little past the tab it's going to;
// under a finger it keeps up. The lift has springs of its own.
const SLIDE = [225, 21] as const;
const LIFT_UP = [576, 44.2] as const;
const LIFT_DOWN = [676, 47.8] as const;
// A dragged lens trails the finger, stretching along the drag and thinning across it by how far
// behind it is, then swings back past its own shape and settles (src/internal/jelly.ts).
const JELLY = [650, 24] as const;
const STRETCH = 0.3;
const REACH = 1.2;
const THIN = 0.55;

/** How far a lens trailing by `lag` stretches, as tanh does it, drawn by the native driver. */
function stretchFor(lag: Animated.AnimatedNode, length: number) {
  const steps = [0, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
  const inputs = steps.map((t) => t * length * REACH);
  const outputs = steps.map((t) => STRETCH * Math.tanh(t));
  const out = (lag as Animated.Value).interpolate({
    inputRange: [...inputs.slice(1).reverse().map((v) => -v), ...inputs],
    outputRange: [...outputs.slice(1).reverse(), ...outputs],
    extrapolate: 'clamp',
  });
  return out;
}

/**
 * The floating tab bar, laid out as iOS 27 lays it out: each tab's icon above its label, the
 * selected one on a pill that deepens the glass under it, and the bar above the system's gesture
 * handle. Under a finger the pill rises into a clear lens, a little larger than the bar is tall,
 * with the tabs under it enlarged and in the selected colour; it follows a drag, stretching as it
 * goes, and settles back into a pill on the tab it's let go over. Minimised, it shrinks to the
 * current tab's icon.
 */
export function TabBar({
  items,
  value,
  defaultValue = null,
  onValueChange,
  tint,
  fontFamily,
  minimized = false,
  onExpand,
  onLayout,
  onHeight,
  onTabLayout,
  style,
  ...props
}: TabBarProps) {
  const ink = useInk();
  const [current, setValue] = useControllable<string | null>(
    value,
    defaultValue ?? items[0]?.value ?? null,
    onValueChange as ((value: string | null) => void) | undefined
  );
  const setCurrent = (next: string | null) => {
    if (next !== current) haptic('select');
    setValue(next);
  };
  const accent = tint ?? ink.accent;
  const [width, setWidth] = useState(0);
  const count = Math.max(1, items.length);
  const slot = Math.max(0, width - TAB.padX * 2) / count;
  const index = items.findIndex((item) => item.value === current);
  const last = slot * (count - 1);

  // Where the selection is, as a tab's distance from the first, and how far the finger's moved.
  const base = useRef(new Animated.Value(Math.max(0, index) * slot)).current;
  const lift = useRef(new Animated.Value(0)).current;
  // What trails the lens, for its stretch. Only its shape comes from this, so it's worked out
  // here rather than by the native driver, which restarts a spring that follows a moving value
  // every frame, so that it doesn't move until the value stops. Where the lens is stays native.
  const trail = useRef(new Animated.Value(0)).current;
  const trailing = useRef({ at: 0, speed: 0, base: 0, dx: 0, frame: 0, last: 0 }).current;
  const full = useRef(new Animated.Value(minimized ? 0 : 1)).current;
  const raisedAt = useRef(0);
  const holding = useRef(false);
  const anchor = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const raise = () => {
    clearTimeout(timer.current);
    raisedAt.current = Date.now();
    spring(lift, 1, ...LIFT_UP).start();
  };
  const lower = (wait: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => spring(lift, 0, ...LIFT_DOWN).start(), Math.max(0, wait));
  };

  useEffect(() => {
    if (holding.current || index < 0 || !slot) return;
    spring(base, index * slot, ...SLIDE).start();
  }, [index, slot]);

  useEffect(() => {
    // Going, the selection and badges leave before the bar draws in past them; coming back, they
    // return as it reaches its length.
    Animated.timing(full, { toValue: minimized ? 0 : 1, duration: minimized ? 80 : 200, delay: minimized ? 0 : 120, useNativeDriver: true }).start();
  }, [minimized]);

  const latest = useLatest({ items, slot, last, setCurrent, index });
  const track = useTrack(!minimized, {
    onStart: ({ x }) => {
      const { slot, items } = latest.current;
      holding.current = true;
      const at = clamp(Math.floor((x - TAB.padX) / (slot || 1)), 0, items.length - 1);
      anchor.current = at * slot;
      // The lens rises where the selection is and is carried to the tab under the finger.
      base.stopAnimation();
      spring(base, anchor.current, ...SLIDE).start();
      raise();
    },
    onEnd: ({ dx }, cancelled) => {
      const { slot, last, items, setCurrent, index } = latest.current;
      holding.current = false;
      const moved = Math.abs(dx) > 6;
      const to = cancelled ? Math.max(0, index) : clamp(Math.round(clamp(anchor.current + dx, 0, last) / (slot || 1)), 0, items.length - 1);
      // The finger's offset goes into where the selection is, so it settles from where it was let go.
      base.stopAnimation((at) => {
        base.setValue(clamp(at + dx, 0, last));
        track.dx.setValue(0);
        spring(base, to * slot, ...SLIDE).start();
      });
      lower(moved ? 0 : TAB.liftMs - (Date.now() - raisedAt.current));
      const item = items[to];
      if (!cancelled && item) setCurrent(item.value);
    },
  });
  const edge = track.edge;

  const lensWidth = slot + TAB.wider;
  const nodes = useMemo(() => {
    const x = held(Animated.add(base, track.dx), 0, last);
    const lag = Animated.subtract(x, trail);
    const stretch = stretchFor(lag, lensWidth || 1);
    const along = Animated.add(1, stretch);
    const across = Animated.subtract(1, Animated.multiply(stretch, THIN));
    const sx = Animated.multiply(Animated.add(1, Animated.multiply(lift, TAB.growX / (slot || 1))), along);
    const sy = Animated.multiply(Animated.add(1, Animated.multiply(lift, TAB.growY / TAB.pill)), across);
    const pull = lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1 - TAB.pull] });
    const steps = [0, 0.25, 0.5, 0.75, 1];
    const zoom = lift.interpolate({ inputRange: steps, outputRange: steps.map((t) => (1 + TAB.zoom * t) / (1 - TAB.pull * t)) });
    return {
      x,
      sx,
      sy,
      backX: Animated.divide(pull, sx),
      backY: Animated.divide(pull, sy),
      zoom,
      left: Animated.multiply(x, -1),
      bar: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + TAB.barGrow] }),
      rest: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    };
  }, [slot, last, lensWidth]);

  // The lens trails where it's been taken on a loose spring, for its stretch: from where it is,
  // as the native driver reports it, a frame at a time while there's anything to catch up.
  const follow = () => {
    if (trailing.frame) return;
    trailing.last = 0;
    const step = (now: number) => {
      const { slot, last } = latest.current;
      const to = clamp(trailing.base + trailing.dx, 0, last);
      const dt = trailing.last ? Math.min(0.032, (now - trailing.last) / 1000) : 1 / 60;
      trailing.last = now;
      for (let i = 0; i < 4; i++) {
        trailing.speed += (-JELLY[0] * (trailing.at - to) - JELLY[1] * trailing.speed) * (dt / 4);
        trailing.at += trailing.speed * (dt / 4);
      }
      const settled = Math.abs(to - trailing.at) < 0.05 && Math.abs(trailing.speed) < 0.5;
      if (settled) trailing.at = to;
      trail.setValue(trailing.at);
      trailing.frame = settled && !holding.current && slot > 0 ? 0 : requestAnimationFrame(step);
    };
    trailing.frame = requestAnimationFrame(step);
  };
  useEffect(() => {
    const listening = [
      base.addListener(({ value }) => {
        trailing.base = value;
        follow();
      }),
      track.dx.addListener(({ value }) => {
        trailing.dx = value;
        follow();
      }),
    ];
    return () => {
      listening.forEach((id, i) => (i ? track.dx : base).removeListener(id));
      cancelAnimationFrame(trailing.frame);
      trailing.frame = 0;
    };
  }, []);
  useEffect(() => {
    if (!slot) return;
    // Laid out afresh, it's where the selection is, with nothing trailing.
    trailing.base = trailing.at = Math.max(0, index) * slot;
    trailing.speed = 0;
    trail.setValue(trailing.at);
  }, [slot]);

  const face = (item: (typeof items)[number], selected: boolean, colour: ColorValue, key?: string) => {
    const icon = selected ? (item.selectedIcon ?? item.icon) : item.icon;
    return (
      <View key={key} style={{ width: slot, height: TAB.pill, alignItems: 'center', justifyContent: 'center' }}>
        {hasGlyph(icon) ? (
          <View style={{ height: 28, justifyContent: 'center' }}>
            <Glyph icon={icon} color={colour} size={26} />
          </View>
        ) : (
          typeof icon === 'string' && (sayNoDrawing(icon), null)
        )}
        <Text numberOfLines={1} style={{ color: colour, fontSize: 10, fontWeight: '500', marginTop: 1, fontFamily: fontFamilyFor(fontFamily) }}>
          {item.label}
        </Text>
      </View>
    );
  };
  const chosen = items[index];
  const miniIcon = chosen ? (chosen.selectedIcon ?? chosen.icon) : undefined;

  return (
    <Animated.View
      {...props}
      pointerEvents={minimized ? 'box-none' : 'auto'}
      onLayout={(event: LayoutChangeEvent) => {
        const { width: across, height: tall } = event.nativeEvent.layout;
        setWidth(across);
        edge.measure();
        onLayout?.(event);
        // The bar and the room under it, down to the screen's edge.
        const below = StyleSheet.flatten(style)?.marginBottom;
        onHeight?.(tall + (typeof below === 'number' ? below : bottomInset() + 8));
        if (onTabLayout) {
          edge.ref.current?.measure((_x: number, _y: number, _w: number, _h: number, left: number, top: number) => {
            const each = Math.max(0, across - TAB.padX * 2) / Math.max(1, items.length);
            onTabLayout(items.map((item, i) => ({ value: item.value, x: left + TAB.padX + i * each, y: top + TAB.padY, width: each, height: tall - TAB.padY * 2 })));
          });
        }
      }}
      style={[{ marginHorizontal: 21, marginBottom: bottomInset() + 8, height: TAB.height, transform: [{ scale: nodes.bar }] }, style]}>
      <View ref={edge.ref} collapsable={false} pointerEvents={minimized ? 'box-none' : 'auto'} accessibilityRole="tablist" style={StyleSheet.absoluteFill} {...track.handlers}>
        <Glass
          pointerEvents="none"
          stays
          open={!minimized}
          growFrom={[0, TAB.height - TAB.miniHeight, TAB.miniWidth, TAB.miniHeight]}
          style={{ height: TAB.height, borderRadius: TAB.height / 2 }}>
          <View style={{ position: 'absolute', top: TAB.padY, left: TAB.padX, right: TAB.padX, flexDirection: 'row' }}>
            {items.map((item) => (
              <View
                key={item.value}
                testID={item.testID}
                accessible={!minimized}
                accessibilityRole="tab"
                accessibilityLabel={item.accessibilityLabel ?? item.label}
                accessibilityState={{ selected: item.value === current }}
                onAccessibilityTap={() => setCurrent(item.value)}>
                {face(item, false, ink.text)}
              </View>
            ))}
          </View>
        </Glass>
        {slot > 0 && index >= 0 && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: TAB.padY,
              left: TAB.padX - TAB.wider / 2,
              width: lensWidth,
              height: TAB.pill,
              opacity: full,
              transform: [{ translateX: nodes.x }, { scaleX: nodes.sx }, { scaleY: nodes.sy }],
            }}>
            <SelectionGlass style={[StyleSheet.absoluteFill, { borderRadius: TAB.pill / 2 }]} />
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: lift }]}>
              {/* Lifted, it's the bar's own glass, risen: the same frosted look, with a rim of its own. */}
              <Glass pointerEvents="none" held style={[StyleSheet.absoluteFill, { borderRadius: TAB.pill / 2 }]} />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  // Held glass lightens towards white, as iOS's does under a finger.
                  { borderRadius: TAB.pill / 2, backgroundColor: ink.dark ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.3)', borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.12)' },
                ]}
              />
            </Animated.View>
            <View style={[StyleSheet.absoluteFill, { borderRadius: TAB.pill / 2, overflow: 'hidden' }]}>
              <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scaleX: nodes.backX }, { scaleY: nodes.backY }] }]}>
                <Animated.View style={{ position: 'absolute', top: 0, left: TAB.wider / 2, flexDirection: 'row', transform: [{ translateX: nodes.left }] }}>
                  {items.map((item) => (
                    <Animated.View key={item.value} style={{ transform: [{ scale: nodes.zoom }] }}>
                      {face(item, true, accent)}
                    </Animated.View>
                  ))}
                </Animated.View>
              </Animated.View>
            </View>
          </Animated.View>
        )}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', top: TAB.padY, left: TAB.padX, right: TAB.padX, flexDirection: 'row', opacity: full }}>
          {items.map((item) => (
            <View key={item.value} style={{ width: slot, height: TAB.pill }}>
              {item.badge != null && (
                <View
                  style={{
                    position: 'absolute',
                    top: 3,
                    left: '55%',
                    minWidth: 18,
                    height: 18,
                    paddingHorizontal: 5,
                    borderRadius: 9,
                    backgroundColor: RED,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{item.badge}</Text>
                </View>
              )}
            </View>
          ))}
        </Animated.View>
        {track.catcher}
      </View>
      <Animated.View
        pointerEvents={minimized ? 'auto' : 'none'}
        style={{ position: 'absolute', left: 0, bottom: 0, width: TAB.miniWidth, height: TAB.miniHeight, opacity: Animated.subtract(1, full) }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={chosen ? `${chosen.accessibilityLabel ?? chosen.label}, show tabs` : 'Show tabs'}
          accessibilityElementsHidden={!minimized}
          importantForAccessibility={minimized ? 'auto' : 'no-hide-descendants'}
          onPress={onExpand}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {hasGlyph(miniIcon) && <Glyph icon={miniIcon} color={accent} size={22} />}
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}
