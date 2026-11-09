import { requireNativeModule, requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

// The package's own icons, drawn natively, answering to the SF Symbols names apps pass for iOS.
const NativeIcon: ComponentType<{ name: string; color: ColorValue; style?: StyleProp<ViewStyle> }> =
  requireNativeView('LiquidGlass', 'IconView');
const native = requireNativeModule<{ hasIcon(name: string): boolean; bottomInset(): number }>('LiquidGlass');

export const hasIcon = (name: string | undefined): name is string => !!name && native.hasIcon(name);

export function Icon({ name, color, size = 22 }: { name: string; color: ColorValue; size?: number }) {
  return <NativeIcon name={name} color={color} style={{ width: size, height: size }} />;
}

/** How tall Android's navigation bar or gesture handle is, in points. */
export const bottomInset = (): number => native.bottomInset();
