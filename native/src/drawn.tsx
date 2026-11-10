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
} from 'react-native';

import { useControllable } from './controllable';
import { Backdrop, FilledGlass, Glass, Lens } from './glass';
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
  MenuProps,
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

function useInk() {
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
const NativeTrack: ComponentType<Record<string, unknown>> | null =
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

/** Whether there's something to show for this icon: one of the package's drawings, or an image. */
const hasGlyph = (icon: IconSource | undefined): icon is IconSource => icon != null && (typeof icon !== 'string' || hasIcon(icon));

/** An icon in `color`: the package's drawing for an SF Symbol's name, or the app's own image. */
function Glyph({ icon, color, size, weight }: { icon: IconSource | undefined; color: ColorValue; size: number; weight?: number }) {
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
    <Animated.View
      ref={press.ref}
      {...press.handlers}
      style={[{ alignSelf: 'flex-start', opacity: disabled ? 0.4 : 1, transform: press.transform }, style]}>
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
  );
}

/** Opens a list under the button. iOS shows its own menu instead. */
export function Menu({ items, onSelect, style, ...props }: MenuProps) {
  const ink = useInk();
  const [open, setOpen] = useState(false);
  return (
    <View style={[{ alignSelf: 'flex-start' }, style]}>
      <Button {...props} onPress={() => setOpen(!open)} />
      {open && (
        <View style={{ marginTop: 6, borderRadius: 14, backgroundColor: ink.raised, paddingVertical: 4, elevation: 6 }}>
          {items.map((item) => (
            <Pressable
              key={item.value}
              disabled={item.disabled}
              onPress={() => {
                setOpen(false);
                onSelect?.(item.value);
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 11,
                paddingHorizontal: 14,
                opacity: item.disabled ? 0.4 : 1,
              }}>
              <View style={{ width: 18, alignItems: 'center' }}>
                {item.checked && <Icon name="checkmark" color={ink.text} size={16} />}
              </View>
              {hasIcon(item.icon) && <Icon name={item.icon} color={item.destructive ? RED : ink.text} size={20} />}
              <Text style={{ color: item.destructive ? RED : ink.text, fontSize: 17, fontFamily: fontFamilyFor(props.fontFamily) }}>
                {!hasIcon('checkmark') && item.checked ? '✓ ' : ''}
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
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
    <View
      {...props}
      style={[{ flexDirection: 'row', alignItems: 'center', height: 32, borderRadius: 16, backgroundColor: ink.stepper, alignSelf: 'flex-start' }, style]}>
      {half(-1)}
      <View style={{ width: 1, height: 16, marginHorizontal: -0.5, backgroundColor: ink.separator }} />
      {half(1)}
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

/**
 * The floating tab bar, laid out as iOS 27 lays it out: each tab's icon above its label, the
 * selected one lifted on a pill, and the bar above the system's gesture handle. Holding it brings
 * up a lens that follows the finger and enlarges the tabs under it.
 */
export function TabBar({
  items,
  value,
  defaultValue = null,
  onValueChange,
  tint,
  fontFamily,
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
  const tab = Math.max(0, width - 8) / count;
  const index = items.findIndex((item) => item.value === current);
  const pill = useRef(new Animated.Value(Math.max(0, index))).current;
  const lens = useRef(new Animated.Value(0)).current;
  const { lift, raise, lower } = useLift();
  const latest = useLatest({ items, tab, setCurrent });

  useEffect(() => {
    if (index >= 0) spring(pill, index, 500, 40).start();
  }, [index]);

  const track = useTrack(true, {
    onStart: () => {
      lens.stopAnimation();
      lens.setValue(0);
      raise();
    },
    onEnd: ({ x }, cancelled) => {
      const { tab, items, setCurrent } = latest.current;
      lens.setValue(clamp(x - 4, tab / 2, tab * items.length - tab / 2));
      track.x.setValue(0);
      lower();
      if (cancelled) return;
      const at = clamp(Math.floor((x - 4) / (tab || 1)), 0, items.length - 1);
      spring(lens, (at + 0.5) * tab, 500, 40).start();
      const item = items[at];
      if (item) setCurrent(item.value);
    },
  });
  const edge = track.edge;
  const shownLens = useMemo(() => held(Animated.add(lens, Animated.add(track.x, -4)), tab / 2, tab * count - tab / 2), [tab, count]);

  const lensWidth = tab + 24;
  return (
    <View
      {...props}
      {...track.handlers}
      ref={edge.ref}
      accessibilityRole="tablist"
      collapsable={false}
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
            const each = Math.max(0, across - 8) / Math.max(1, items.length);
            onTabLayout(items.map((item, i) => ({ value: item.value, x: left + 4 + i * each, y: top + 4, width: each, height: tall - 8 })));
          });
        }
      }}
      style={[{ marginHorizontal: 21, marginBottom: bottomInset() + 8, height: 62 }, style]}>
      <Glass pointerEvents="none" style={{ height: 62, borderRadius: 31 }}>
        <Backdrop style={StyleSheet.absoluteFill}>
          {index >= 0 && tab > 0 && (
            <Animated.View
              style={{
                position: 'absolute',
                top: 4,
                left: 4,
                width: tab,
                height: 54,
                borderRadius: 27,
                backgroundColor: ink.pill,
                // Held, the lens is the selection, as on iOS: the pill makes way for it, and comes
                // back under the chosen tab as the lens settles.
                opacity: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [{ translateX: Animated.multiply(pill, tab) }],
              }}
            />
          )}
          <View style={{ position: 'absolute', top: 4, bottom: 4, left: 4, right: 4, flexDirection: 'row' }}>
            {items.map((item) => {
              const selected = item.value === current;
              const colour = selected ? accent : ink.text;
              const icon = selected ? (item.selectedIcon ?? item.icon) : item.icon;
              return (
                <View
                  key={item.value}
                  testID={item.testID}
                  accessible
                  accessibilityRole="tab"
                  accessibilityLabel={item.accessibilityLabel ?? item.label}
                  accessibilityState={{ selected }}
                  onAccessibilityTap={() => setCurrent(item.value)}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {hasGlyph(icon) ? (
                    <View style={{ height: 28, justifyContent: 'center' }}>
                      <Glyph icon={icon} color={colour} size={26} />
                    </View>
                  ) : (
                    typeof icon === 'string' && (sayNoDrawing(icon), null)
                  )}
                  <Text style={{ color: colour, fontSize: 10, fontWeight: '500', marginTop: 1, fontFamily: fontFamilyFor(fontFamily) }}>{item.label}</Text>
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
              );
            })}
          </View>
        </Backdrop>
      </Glass>
      {tab > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -5,
            left: 4,
            width: lensWidth,
            height: 72,
            opacity: lift,
            transform: [
              { translateX: Animated.subtract(shownLens, lensWidth / 2) },
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            ],
          }}>
          <Lens style={[StyleSheet.absoluteFill, { borderRadius: 36 }]} zoom={1.2} split={0.12} />
          <View style={[StyleSheet.absoluteFill, { borderRadius: 36, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.18)' }]} />
        </Animated.View>
      )}
      {track.catcher}
    </View>
  );
}
