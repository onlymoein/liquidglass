import { requireNativeView } from 'expo';
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { Dimensions, type LayoutChangeEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';

import { useControllable } from './controllable';
import * as Drawn from './drawn';
import { Menu as DrawnMenu } from './menu';
import { fontFamilyFor } from './font';
import { iconParts } from './icons';
import { native, sayMissing } from './native';
import type {
  ButtonProps,
  MenuProps,
  SegmentedControlProps,
  SliderProps,
  StepperProps,
  SwitchProps,
  TabBarProps,
  TabLayout,
} from './types';

// Each control is UIKit's own, which iOS 26 and later draw in Liquid Glass.

type Size = { width: number; height: number };
type Value<T> = NativeSyntheticEvent<{ value: T }>;
type Native = ComponentType<Record<string, unknown> & { style?: StyleProp<ViewStyle> }>;

const view = (name: string): Native | null => (native ? requireNativeView('LiquidGlass', name) : null);
const NativeSwitch = view('SwitchView');
const NativeSlider = view('SliderView');
const NativeStepper = view('StepperView');
const NativeSegmentedControl = view('SegmentedControlView');
const NativeTabBar = view('TabBarView');
const NativeButton = view('ButtonView');

// The sizes iOS 26 and later give each control, measured on the iPhone simulator, so a control
// takes its place at once rather than growing into it when UIKit reports its size a moment later.
const SWITCH = { width: 63, height: 28 };
const STEPPER = { width: 94, height: 32 };
const SLIDER = 34;
const SEGMENTED = 32;
const TAB_BAR = 49;
const BUTTON = { small: 32, regular: 39, large: 55 } as const;
const CIRCLE = { small: 32, regular: 41, large: 55 } as const;
const PADDING = { small: 10, regular: 12, large: 20 } as const;
const LETTER = { small: 7.6, regular: 8.6, large: 8.8 } as const;
const ICON = { small: 22, regular: 26, large: 30 } as const;

/** A first guess at a button's width, from its label, until UIKit says. */
function guessButton(size: 'small' | 'regular' | 'large', label: string | null | undefined, hasIcon: boolean): Size {
  if (!label) return { width: CIRCLE[size], height: CIRCLE[size] };
  const width = label.length * LETTER[size] + PADDING[size] * 2 + (hasIcon ? ICON[size] + 6 : 0);
  return { width: Math.round(width), height: BUTTON[size] };
}

/** The room under a tab bar at the foot of the screen: the home indicator's, on phones that have one. */
const homeIndicator = () => {
  const { width, height } = Dimensions.get('window');
  return Math.max(width, height) >= 812 ? 34 : 0;
};

/**
 * The size UIKit wants the control to be, starting from what it's known to be. A control that
 * fills the width it's given, as a slider does, takes only its height.
 */
function useNativeSize(fill: boolean, initial: Size) {
  const [size, setSize] = useState<Size | null>(null);
  const onSize = useCallback((event: NativeSyntheticEvent<Size>) => setSize(event.nativeEvent), []);
  const style: ViewStyle = fill
    ? { alignSelf: 'stretch', height: size?.height ?? initial.height }
    : { width: size?.width ?? initial.width, height: size?.height ?? initial.height };
  return { onSize, style };
}

/**
 * UIKit's controls change under the finger before the app has had a say. When the app owns the
 * value and doesn't take the change, nothing would tell the control to go back, so this does:
 * after the app has answered, if the value is still the old one, the control is put back.
 */
function useResync<T>(current: T) {
  const [asked, setAsked] = useState<{ value: T } | null>(null);
  const [resync, setResync] = useState(0);
  useEffect(() => {
    if (!asked) return;
    if (!Object.is(asked.value, current)) setResync((count) => count + 1);
    setAsked(null);
  }, [asked, current]);
  return { resync, asked: (value: T) => setAsked({ value }) };
}

if (!native) sayMissing();

export function Switch({ checked, defaultChecked = false, onCheckedChange, style, ...props }: SwitchProps) {
  const [value, setValue] = useControllable(checked, defaultChecked, onCheckedChange);
  const size = useNativeSize(false, SWITCH);
  const sync = useResync(value);
  if (!NativeSwitch) return <Drawn.Switch checked={checked} defaultChecked={defaultChecked} onCheckedChange={onCheckedChange} style={style} {...props} />;
  return (
    <NativeSwitch
      {...props}
      accessibilityRole="switch"
      checked={value}
      resync={sync.resync}
      onValueChange={(event: Value<boolean>) => {
        setValue(event.nativeEvent.value);
        sync.asked(event.nativeEvent.value);
      }}
      onSize={size.onSize}
      style={[size.style, style]}
    />
  );
}

export function Slider({
  value,
  defaultValue,
  onValueChange,
  onSlidingComplete,
  min = 0,
  max = 1,
  style,
  ...props
}: SliderProps) {
  const [current, setCurrent] = useControllable(value, defaultValue ?? min, onValueChange);
  const size = useNativeSize(true, { width: 0, height: SLIDER });
  const sync = useResync(current);
  // UIKit sends a value for every move of the finger. The app hears it at most once a frame, so a
  // screen that's slow to draw again doesn't fall behind; the thumb is UIKit's and never waits.
  const waiting = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const report = () => {
    frame.current = null;
    const next = waiting.current;
    waiting.current = null;
    if (next != null) setCurrent(next);
  };
  if (!NativeSlider) {
    return (
      <Drawn.Slider
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
        min={min}
        max={max}
        style={style}
        {...props}
      />
    );
  }
  return (
    <NativeSlider
      {...props}
      min={min}
      max={max}
      value={current}
      resync={sync.resync}
      onValueChange={(event: Value<number>) => {
        waiting.current = event.nativeEvent.value;
        frame.current ??= requestAnimationFrame(report);
      }}
      onSlidingComplete={(event: Value<number>) => {
        // The last value first, then that the finger's lifted.
        if (frame.current != null) cancelAnimationFrame(frame.current);
        waiting.current = event.nativeEvent.value;
        report();
        onSlidingComplete?.(event.nativeEvent.value);
        // Once it's let go, the thumb shows the app's value.
        sync.asked(event.nativeEvent.value);
      }}
      onSize={size.onSize}
      style={[size.style, style]}
    />
  );
}

export function Stepper({ value, defaultValue, onValueChange, min = 0, max = 100, style, ...props }: StepperProps) {
  const [current, setCurrent] = useControllable(value, defaultValue ?? min, onValueChange);
  const size = useNativeSize(false, STEPPER);
  const sync = useResync(current);
  if (!NativeStepper) {
    return <Drawn.Stepper value={value} defaultValue={defaultValue} onValueChange={onValueChange} min={min} max={max} style={style} {...props} />;
  }
  return (
    <NativeStepper
      {...props}
      min={min}
      max={max}
      value={current}
      resync={sync.resync}
      onValueChange={(event: Value<number>) => {
        setCurrent(event.nativeEvent.value);
        sync.asked(event.nativeEvent.value);
      }}
      onSize={size.onSize}
      style={[size.style, style]}
    />
  );
}

export function SegmentedControl({ items, value, defaultValue, onValueChange, fontFamily, style, ...props }: SegmentedControlProps) {
  const [current, setCurrent] = useControllable<string | undefined>(
    value,
    defaultValue ?? items[0]?.value,
    onValueChange as ((value: string | undefined) => void) | undefined
  );
  const size = useNativeSize(true, { width: 0, height: SEGMENTED });
  const sync = useResync(current);
  if (!NativeSegmentedControl) {
    return (
      <Drawn.SegmentedControl
        items={items}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        fontFamily={fontFamily}
        style={style}
        {...props}
      />
    );
  }
  return (
    <NativeSegmentedControl
      {...props}
      items={items}
      selected={current ?? null}
      fontFamily={fontFamilyFor(fontFamily) ?? null}
      resync={sync.resync}
      onValueChange={(event: Value<string>) => {
        setCurrent(event.nativeEvent.value);
        sync.asked(event.nativeEvent.value);
      }}
      onSize={size.onSize}
      style={[size.style, style]}
    />
  );
}

/**
 * iOS's tab bar. Put it at the foot of the screen; it floats there as a capsule of glass. For a
 * whole app with tabs, Expo Router's native tabs give the same bar along with the screens.
 */
export function TabBar({
  items,
  value,
  defaultValue = null,
  onValueChange,
  fontFamily,
  minimized = false,
  onExpand,
  onLayout,
  onHeight,
  onTabLayout,
  style,
  ...props
}: TabBarProps) {
  const [current, setCurrent] = useControllable<string | null>(
    value,
    defaultValue ?? items[0]?.value ?? null,
    onValueChange as ((value: string | null) => void) | undefined
  );
  const size = useNativeSize(true, { width: 0, height: TAB_BAR + homeIndicator() });
  const sync = useResync(current);
  if (!NativeTabBar) {
    return (
      <Drawn.TabBar
        items={items}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        fontFamily={fontFamily}
        minimized={minimized}
        onExpand={onExpand}
        onLayout={onLayout}
        onHeight={onHeight}
        onTabLayout={onTabLayout}
        style={style}
        {...props}
      />
    );
  }
  const tabs = items.map((item) => {
    const icon = iconParts(item.icon);
    const selected = iconParts(item.selectedIcon);
    // Only what's given: a field left out stays out, rather than going over as null.
    return Object.fromEntries(
      Object.entries({
        value: item.value,
        label: item.label,
        icon: icon.symbol,
        selectedIcon: selected.symbol,
        iconUri: icon.uri,
        selectedIconUri: selected.uri,
        badge: item.badge,
        testID: item.testID,
        accessibilityLabel: item.accessibilityLabel,
      }).filter(([, field]) => field != null)
    );
  });
  return (
    <NativeTabBar
      {...props}
      items={tabs}
      selected={current}
      fontFamily={fontFamilyFor(fontFamily) ?? null}
      resync={sync.resync}
      minimized={minimized}
      onExpand={() => onExpand?.()}
      onValueChange={(event: Value<string>) => {
        setCurrent(event.nativeEvent.value);
        sync.asked(event.nativeEvent.value);
      }}
      onTabLayout={(event: NativeSyntheticEvent<{ tabs: TabLayout[] }>) => onTabLayout?.(event.nativeEvent.tabs)}
      onLayout={(event: LayoutChangeEvent) => {
        onLayout?.(event);
        // The bar reaches down to the screen's edge, home indicator and all.
        onHeight?.(event.nativeEvent.layout.height);
      }}
      onSize={size.onSize}
      style={[size.style, style]}
    />
  );
}

export function Button({ label, children, onPress, icon, fontFamily, size = 'regular', style, ...props }: ButtonProps) {
  const text = label ?? children ?? null;
  const parts = iconParts(icon);
  const measured = useNativeSize(false, guessButton(size, text, icon != null));
  if (!NativeButton) {
    return (
      <Drawn.Button label={label} icon={icon} fontFamily={fontFamily} size={size} onPress={onPress} style={style} {...props}>
        {children}
      </Drawn.Button>
    );
  }
  return (
    <NativeButton
      {...props}
      accessibilityRole="button"
      label={text}
      size={size}
      icon={parts.symbol ?? null}
      iconUri={parts.uri ?? null}
      fontFamily={fontFamilyFor(fontFamily) ?? null}
      onTrigger={() => onPress?.()}
      onSize={measured.onSize}
      style={[measured.style, style]}
    />
  );
}

/** A button that opens iOS's own menu. */
export function Menu({ items, onSelect, label, children, icon, fontFamily, size = 'regular', style, ...props }: MenuProps) {
  const text = label ?? children ?? null;
  const parts = iconParts(icon);
  const measured = useNativeSize(false, guessButton(size, text, icon != null));
  if (!NativeButton) {
    return (
      <DrawnMenu items={items} onSelect={onSelect} label={label} icon={icon} fontFamily={fontFamily} size={size} style={style} {...props}>
        {children}
      </DrawnMenu>
    );
  }
  return (
    <NativeButton
      {...props}
      accessibilityRole="button"
      label={text}
      size={size}
      icon={parts.symbol ?? null}
      iconUri={parts.uri ?? null}
      fontFamily={fontFamilyFor(fontFamily) ?? null}
      menu={items}
      onMenuSelect={(event: Value<string>) => onSelect?.(event.nativeEvent.value)}
      onSize={measured.onSize}
      style={[measured.style, style]}
    />
  );
}
