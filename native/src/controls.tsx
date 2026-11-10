import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
  type ColorValue,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';

import { useControllable } from './controllable';
import { Backdrop, FilledGlass, Glass, Lens } from './glass';
import { Icon, bottomInset, hasIcon } from './icon';
import { haptic } from './haptics';
import { usePress } from './press';
import { Text } from './text';
import type {
  ButtonProps,
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
  style,
  ...props
}: ButtonProps) {
  const ink = useInk();
  const colour: ColorValue = destructive ? RED : (tint ?? BLUE);
  const filled = variant === 'filled';
  const text = label ?? children;
  const ink2: ColorValue = filled ? '#fff' : destructive || tint ? colour : ink.text;
  const symbol = hasIcon(icon) ? icon : undefined;
  // An icon on its own makes a circle, as on iOS. Without a drawing for it, its label's first letter.
  const lone = !text;
  const height = lone ? circles[size] : heights[size];
  const fallback = lone && !symbol ? (props.accessibilityLabel ?? '').slice(0, 1) : undefined;
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
        {symbol && <Icon name={symbol} color={ink2} size={Math.round(heights[size] * ICON_SCALE)} weight={ICON_WEIGHT} />}
        {(text || fallback) && (
          <Text style={{ color: ink2, fontSize: size === 'small' ? 15 : 17, fontWeight: '500' }}>{text ?? fallback}</Text>
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
              <Text style={{ color: item.destructive ? RED : ink.text, fontSize: 17 }}>
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

  const responder = useMemo(() => {
    let from = 0;
    let moved = false;
    const at = (dx: number) => clamp(from + dx / SWITCH_TRAVEL, 0, 1);
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderTerminationRequest: () => !moved,
      onPanResponderGrant: () => {
        from = latest.current.value ? 1 : 0;
        moved = false;
        raise();
      },
      onPanResponderMove: (_, gesture) => {
        if (!moved && Math.abs(gesture.dx) < 4) return;
        moved = true;
        position.setValue(at(gesture.dx));
      },
      onPanResponderRelease: (_, gesture) => {
        lower();
        const next = moved ? at(gesture.dx) > 0.5 : !latest.current.value;
        if (next !== latest.current.value) latest.current.setValue(next);
        else settle(next);
      },
      onPanResponderTerminate: () => {
        lower();
        settle(latest.current.value);
      },
    });
  }, []);

  return (
    <View
      {...props}
      {...responder.panHandlers}
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
            { translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, SWITCH_TRAVEL] }) },
            { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, THUMB_SWELL] }) },
          ],
        }}>
        <Thumb lift={lift} radius={12} />
      </Animated.View>
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

  const responder = useMemo(() => {
    let from = 0;
    const valueAt = (dx: number) => {
      const { span, min, max, step } = latest.current;
      const raw = min + clamp(from + dx / span, 0, 1) * (max - min);
      return step > 0 ? Math.min(max, min + Math.round((raw - min) / step) * step) : raw;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const { current, min, max } = latest.current;
        from = (current - min) / (max - min || 1);
        dragging.current = true;
        raise();
      },
      onPanResponderMove: (_, gesture) => {
        const { min, max } = latest.current;
        const next = valueAt(gesture.dx);
        progress.setValue((next - min) / (max - min || 1));
        if (next !== latest.current.current) latest.current.setCurrent(next);
      },
      onPanResponderRelease: (_, gesture) => {
        dragging.current = false;
        lower();
        latest.current.onSlidingComplete?.(valueAt(gesture.dx));
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        lower();
      },
    });
  }, []);

  return (
    <View
      {...props}
      {...responder.panHandlers}
      accessible
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: current }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
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
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [18.5 - width, span + 18.5 - width] }) }],
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
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, span] }) },
            { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, THUMB_SWELL] }) },
          ],
        }}>
        <Thumb lift={lift} radius={12} shadow />
      </Animated.View>
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

export function SegmentedControl({ items, value, defaultValue, onValueChange, disabled, style, ...props }: SegmentedControlProps) {
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

  const edge = useLeftEdge();
  const responder = useMemo(() => {
    let start = 0;
    const to = (x: number) => {
      const { segment, width } = latest.current;
      return clamp(x, segment / 2, width - segment / 2);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event: GestureResponderEvent) => {
        start = event.nativeEvent.pageX - edge.left.current;
        edge.measure();
        lens.setValue(to(start));
        raise();
      },
      onPanResponderMove: (_, gesture) => lens.setValue(to(start + gesture.dx)),
      onPanResponderRelease: (_, gesture) => {
        const { items, segment, setCurrent } = latest.current;
        const at = clamp(Math.floor((start + gesture.dx) / (segment || 1)), 0, items.length - 1);
        const item = items[at];
        spring(lens, (at + 0.5) * segment, 500, 40).start();
        lower();
        if (item && !item.disabled) setCurrent(item.value);
      },
      onPanResponderTerminate: () => lower(),
    });
  }, []);

  const lensWidth = segment + 21;
  return (
    <View
      {...props}
      {...responder.panHandlers}
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
                  <Text numberOfLines={1} style={{ color: ink.text, fontSize: 14, fontWeight: selected ? '500' : '400' }}>
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
              { translateX: Animated.subtract(lens, lensWidth / 2) },
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
            ],
          }}>
          <Lens style={[StyleSheet.absoluteFill, { borderRadius: 22 }]} zoom={1.08} split={0.08} />
          <View style={[StyleSheet.absoluteFill, { borderRadius: 22, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.25)' }]} />
        </Animated.View>
      )}
    </View>
  );
}

/**
 * The floating tab bar, laid out as iOS 27 lays it out: each tab's icon above its label, the
 * selected one lifted on a pill, and the bar above the system's gesture handle. Holding it brings
 * up a lens that follows the finger and enlarges the tabs under it.
 */
export function TabBar({ items, value, defaultValue = null, onValueChange, tint, style, ...props }: TabBarProps) {
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

  const edge = useLeftEdge();
  const responder = useMemo(() => {
    let start = 0;
    const centre = (x: number) => {
      const { tab, items } = latest.current;
      return clamp(x - 4, tab / 2, tab * items.length - tab / 2);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event: GestureResponderEvent) => {
        start = event.nativeEvent.pageX - edge.left.current;
        edge.measure();
        lens.setValue(centre(start));
        raise();
      },
      onPanResponderMove: (_, gesture) => lens.setValue(centre(start + gesture.dx)),
      onPanResponderRelease: (_, gesture) => {
        const { tab, items, setCurrent } = latest.current;
        const at = clamp(Math.floor((start + gesture.dx - 4) / (tab || 1)), 0, items.length - 1);
        spring(lens, (at + 0.5) * tab, 500, 40).start();
        lower();
        const item = items[at];
        if (item) setCurrent(item.value);
      },
      onPanResponderTerminate: () => lower(),
    });
  }, []);

  const lensWidth = tab + 24;
  return (
    <View
      {...props}
      {...responder.panHandlers}
      ref={edge.ref}
      accessibilityRole="tablist"
      collapsable={false}
      onLayout={(event: LayoutChangeEvent) => {
        setWidth(event.nativeEvent.layout.width);
        edge.measure();
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
                  accessible
                  accessibilityRole="tab"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected }}
                  onAccessibilityTap={() => setCurrent(item.value)}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  {hasIcon(icon) && (
                    <View style={{ height: 28, justifyContent: 'center' }}>
                      <Icon name={icon} color={colour} size={26} />
                    </View>
                  )}
                  <Text style={{ color: colour, fontSize: 10, fontWeight: '500', marginTop: 1 }}>{item.label}</Text>
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
              { translateX: Animated.subtract(lens, lensWidth / 2) },
              { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
            ],
          }}>
          <Lens style={[StyleSheet.absoluteFill, { borderRadius: 36 }]} zoom={1.2} split={0.12} />
          <View style={[StyleSheet.absoluteFill, { borderRadius: 36, borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.18)' }]} />
        </Animated.View>
      )}
    </View>
  );
}
