import { requireNativeView } from 'expo';
import { useCallback, useState, type ComponentType } from 'react';
import type { NativeSyntheticEvent, StyleProp, ViewStyle } from 'react-native';

import { useControllable } from './controllable';
import type {
  ButtonProps,
  MenuProps,
  SegmentedControlProps,
  SliderProps,
  StepperProps,
  SwitchProps,
  TabBarProps,
} from './types';

// Each control is UIKit's own, which iOS 26 and later draw in Liquid Glass.

type Size = { width: number; height: number };
type Value<T> = NativeSyntheticEvent<{ value: T }>;
type Native = ComponentType<Record<string, unknown> & { style?: StyleProp<ViewStyle> }>;

const view = (name: string): Native => requireNativeView('LiquidGlass', name);
const NativeSwitch = view('SwitchView');
const NativeSlider = view('SliderView');
const NativeStepper = view('StepperView');
const NativeSegmentedControl = view('SegmentedControlView');
const NativeTabBar = view('TabBarView');
const NativeButton = view('ButtonView');

/**
 * The size UIKit wants the control to be. A control that fills the width it's given, as a slider
 * does, takes only its height.
 */
function useNativeSize(fill: boolean) {
  const [size, setSize] = useState<Size | null>(null);
  const onSize = useCallback((event: NativeSyntheticEvent<Size>) => setSize(event.nativeEvent), []);
  const style: ViewStyle = fill
    ? { alignSelf: 'stretch', height: size?.height ?? 32 }
    : { width: size?.width ?? 1, height: size?.height ?? 1 };
  return { onSize, style };
}

export function Switch({ checked, defaultChecked = false, onCheckedChange, style, ...props }: SwitchProps) {
  const [value, setValue] = useControllable(checked, defaultChecked, onCheckedChange);
  const size = useNativeSize(false);
  return (
    <NativeSwitch
      {...props}
      accessibilityRole="switch"
      checked={value}
      onValueChange={(event: Value<boolean>) => setValue(event.nativeEvent.value)}
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
  const size = useNativeSize(true);
  return (
    <NativeSlider
      {...props}
      min={min}
      max={max}
      value={current}
      onValueChange={(event: Value<number>) => setCurrent(event.nativeEvent.value)}
      onSlidingComplete={(event: Value<number>) => onSlidingComplete?.(event.nativeEvent.value)}
      onSize={size.onSize}
      style={[size.style, style]}
    />
  );
}

export function Stepper({ value, defaultValue, onValueChange, min = 0, max = 100, style, ...props }: StepperProps) {
  const [current, setCurrent] = useControllable(value, defaultValue ?? min, onValueChange);
  const size = useNativeSize(false);
  return (
    <NativeStepper
      {...props}
      min={min}
      max={max}
      value={current}
      onValueChange={(event: Value<number>) => setCurrent(event.nativeEvent.value)}
      onSize={size.onSize}
      style={[size.style, style]}
    />
  );
}

export function SegmentedControl({ items, value, defaultValue, onValueChange, style, ...props }: SegmentedControlProps) {
  const [current, setCurrent] = useControllable<string | undefined>(value, defaultValue ?? items[0]?.value, onValueChange as ((value: string | undefined) => void) | undefined);
  const size = useNativeSize(true);
  return (
    <NativeSegmentedControl
      {...props}
      items={items}
      selected={current ?? null}
      onValueChange={(event: Value<string>) => setCurrent(event.nativeEvent.value)}
      onSize={size.onSize}
      style={[size.style, style]}
    />
  );
}

/**
 * iOS's tab bar. Put it at the foot of the screen; it floats there as a capsule of glass. For a
 * whole app with tabs, Expo Router's native tabs give the same bar along with the screens.
 */
export function TabBar({ items, value, defaultValue = null, onValueChange, style, ...props }: TabBarProps) {
  const [current, setCurrent] = useControllable<string | null>(
    value,
    defaultValue ?? items[0]?.value ?? null,
    onValueChange as ((value: string | null) => void) | undefined
  );
  const size = useNativeSize(true);
  return (
    <NativeTabBar
      {...props}
      items={items}
      selected={current}
      onValueChange={(event: Value<string>) => setCurrent(event.nativeEvent.value)}
      onSize={size.onSize}
      style={[size.style, style]}
    />
  );
}

export function Button({ label, children, onPress, style, ...props }: ButtonProps) {
  const size = useNativeSize(false);
  return (
    <NativeButton
      {...props}
      accessibilityRole="button"
      label={label ?? children ?? null}
      onTrigger={() => onPress?.()}
      onSize={size.onSize}
      style={[size.style, style]}
    />
  );
}

/** A button that opens iOS's own menu. */
export function Menu({ items, onSelect, label, children, style, ...props }: MenuProps) {
  const size = useNativeSize(false);
  return (
    <NativeButton
      {...props}
      accessibilityRole="button"
      label={label ?? children ?? null}
      menu={items}
      onMenuSelect={(event: Value<string>) => onSelect?.(event.nativeEvent.value)}
      onSize={size.onSize}
      style={[size.style, style]}
    />
  );
}
