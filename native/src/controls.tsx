import { useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Switch as NativeSwitch,
  Text,
  View,
  useColorScheme,
  type ColorValue,
  type LayoutChangeEvent,
} from 'react-native';

import { useControllable } from './controllable';
import { Glass } from './glass';
import { Icon, bottomInset, hasIcon } from './icon';
import type {
  ButtonProps,
  MenuProps,
  SegmentedControlProps,
  SliderProps,
  StepperProps,
  SwitchProps,
  TabBarProps,
} from './types';

// The controls where iOS's own aren't there: on Android, laid out as iOS lays them out and on the
// package's glass; on the web, plain controls in the same sizes, so a screen keeps its layout.

const BLUE = '#0a84ff';
const RED = '#ff3b30';

function useInk() {
  const dark = useColorScheme() === 'dark';
  return {
    text: dark ? '#fff' : '#000',
    faint: dark ? 'rgba(235,235,245,0.6)' : 'rgba(60,60,67,0.6)',
    fill: dark ? 'rgba(120,120,128,0.36)' : 'rgba(120,120,128,0.16)',
    raised: dark ? '#636366' : '#fff',
    /** Behind the selected tab, as iOS 27 lifts it. */
    pill: dark ? 'rgba(0,0,0,0.32)' : 'rgba(120,120,128,0.14)',
    accent: dark ? '#0a84ff' : '#007aff',
  };
}

const heights = { small: 28, regular: 36, large: 52 } as const;

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
  const height = heights[size];
  const symbol = hasIcon(icon) ? icon : undefined;
  // An icon on its own makes a circle, as on iOS. Without a drawing for it, its label's first letter.
  const lone = !text;
  const fallback = lone && !symbol ? (props.accessibilityLabel ?? '').slice(0, 1) : undefined;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height,
          minWidth: height,
          paddingHorizontal: lone ? 0 : height / 2.4,
          borderRadius: height / 2,
          flexDirection: 'row',
          gap: 6,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: filled ? colour : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}>
      {!filled && <Glass interactive style={[StyleSheet.absoluteFill, { borderRadius: height / 2 }]} />}
      {symbol && <Icon name={symbol} color={ink2} size={Math.round(height * (lone ? 0.56 : 0.55))} />}
      {(text || fallback) && (
        <Text style={{ color: ink2, fontSize: size === 'small' ? 15 : 17, fontWeight: '500' }}>{text ?? fallback}</Text>
      )}
    </Pressable>
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

export function Switch({ checked, defaultChecked = false, onCheckedChange, tint, ...props }: SwitchProps) {
  const [value, setValue] = useControllable(checked, defaultChecked, onCheckedChange);
  return (
    <NativeSwitch {...props} value={value} onValueChange={setValue} trackColor={{ true: tint ?? '#34c759' }} />
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
  const [current, setCurrent] = useControllable(value, defaultValue ?? min, onValueChange);
  const width = useRef(0);
  const latest = useRef(current);
  latest.current = current;
  const at = (x: number) => {
    const share = Math.min(1, Math.max(0, x / (width.current || 1)));
    const raw = min + share * (max - min);
    return step > 0 ? Math.min(max, min + Math.round((raw - min) / step) * step) : raw;
  };
  const move = (x: number) => {
    const next = at(x);
    if (next !== latest.current) setCurrent(next);
  };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (event) => move(event.nativeEvent.locationX),
      onPanResponderMove: (event) => move(event.nativeEvent.locationX),
      onPanResponderRelease: () => onSlidingComplete?.(latest.current),
    })
  ).current;
  const share = (current - min) / (max - min || 1);
  return (
    <View
      {...props}
      {...responder.panHandlers}
      onLayout={(event: LayoutChangeEvent) => (width.current = event.nativeEvent.layout.width)}
      style={[{ height: 28, justifyContent: 'center', opacity: disabled ? 0.4 : 1 }, style]}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: ink.fill }}>
        <View style={{ width: `${share * 100}%`, height: 6, borderRadius: 3, backgroundColor: tint ?? BLUE }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: `${share * 100}%`,
          marginLeft: -14,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#fff',
          elevation: 3,
        }}
      />
    </View>
  );
}

export function Stepper({ value, defaultValue, onValueChange, min = 0, max = 100, step = 1, disabled, style, ...props }: StepperProps) {
  const ink = useInk();
  const [current, setCurrent] = useControllable(value, defaultValue ?? min, onValueChange);
  const half = (sign: -1 | 1, text: string) => {
    const next = Math.min(max, Math.max(min, current + sign * step));
    return (
      <Pressable
        accessibilityLabel={sign < 0 ? 'Decrement' : 'Increment'}
        disabled={disabled || next === current}
        onPress={() => setCurrent(next)}
        style={{ width: 47, alignItems: 'center', justifyContent: 'center', opacity: next === current ? 0.3 : 1 }}>
        <Text style={{ color: ink.text, fontSize: 20 }}>{text}</Text>
      </Pressable>
    );
  };
  return (
    <View {...props} style={[{ flexDirection: 'row', height: 32, borderRadius: 16, backgroundColor: ink.fill, alignSelf: 'flex-start' }, style]}>
      {half(-1, '−')}
      {half(1, '+')}
    </View>
  );
}

export function SegmentedControl({ items, value, defaultValue, onValueChange, disabled, style, ...props }: SegmentedControlProps) {
  const ink = useInk();
  const [current, setCurrent] = useControllable<string | undefined>(value, defaultValue ?? items[0]?.value, onValueChange as ((value: string | undefined) => void) | undefined);
  return (
    <View {...props} style={[{ flexDirection: 'row', height: 32, borderRadius: 16, padding: 2, backgroundColor: ink.fill }, style]}>
      {items.map((item) => (
        <Pressable
          key={item.value}
          disabled={disabled || item.disabled}
          onPress={() => setCurrent(item.value)}
          style={{
            flex: 1,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: item.value === current ? ink.raised : 'transparent',
          }}>
          {!item.label && hasIcon(item.icon) ? (
            <Icon name={item.icon} color={ink.text} size={18} />
          ) : (
            <Text style={{ color: ink.text, fontSize: 13, fontWeight: item.value === current ? '600' : '400' }}>{item.label}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The floating tab bar, laid out as iOS 27 lays it out: each tab's icon above its label, the
 * selected one lifted on a pill, and the bar above the system's gesture handle.
 */
export function TabBar({ items, value, defaultValue = null, onValueChange, tint, style, ...props }: TabBarProps) {
  const ink = useInk();
  const [current, setCurrent] = useControllable<string | null>(
    value,
    defaultValue ?? items[0]?.value ?? null,
    onValueChange as ((value: string | null) => void) | undefined
  );
  const accent = tint ?? ink.accent;
  return (
    <View {...props} accessibilityRole="tablist" style={[{ marginHorizontal: 21, marginBottom: bottomInset() + 8 }, style]}>
      <Glass style={{ flexDirection: 'row', height: 62, borderRadius: 31, padding: 4 }}>
        {items.map((item) => {
          const selected = item.value === current;
          const colour = selected ? accent : ink.text;
          const icon = selected ? (item.selectedIcon ?? item.icon) : item.icon;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => setCurrent(item.value)}
              style={{
                flex: 1,
                borderRadius: 27,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? ink.pill : 'transparent',
              }}>
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
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}
