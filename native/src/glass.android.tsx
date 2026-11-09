import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import { StyleSheet, useColorScheme, View, type ColorValue, type ViewProps } from 'react-native';

import type { BackdropProps, GlassGroupProps, GlassProps } from './types';

export type LensProps = ViewProps & { zoom?: number; split?: number };

// Android has no Liquid Glass of its own, so this package draws it: a Backdrop records what's
// behind, and Glass draws that again, bent at the rim, blurred and toned.

type NativeGlassProps = ViewProps & {
  cornerRadius: number;
  clear: boolean;
  dark: boolean;
  tint?: ColorValue;
  lens?: boolean;
  zoom?: number;
  split?: number;
};
const NativeGlass: ComponentType<NativeGlassProps> = requireNativeView('LiquidGlass', 'GlassView');
const NativeBackdrop: ComponentType<ViewProps> = requireNativeView('LiquidGlass', 'BackdropView');

export function Glass({ variant = 'regular', tint, interactive: _interactive, colorScheme = 'auto', style, ...props }: GlassProps) {
  const system = useColorScheme();
  const dark = colorScheme === 'auto' ? system === 'dark' : colorScheme === 'dark';
  const radius = StyleSheet.flatten(style)?.borderRadius;
  return (
    <NativeGlass
      {...props}
      style={style}
      cornerRadius={typeof radius === 'number' ? radius : 0}
      clear={variant === 'clear'}
      dark={dark}
      tint={tint}
    />
  );
}

/**
 * A held thumb, or the tab bar's lens: perfectly clear glass that bends what's under it at its
 * rim, can enlarge it, and parts its colours there.
 */
export function Lens({ zoom = 1, split = 0, style, ...props }: LensProps) {
  const system = useColorScheme();
  const radius = StyleSheet.flatten(style)?.borderRadius;
  return (
    <NativeGlass
      {...props}
      style={style}
      cornerRadius={typeof radius === 'number' ? radius : 0}
      clear
      lens
      zoom={zoom}
      split={split}
      dark={system === 'dark'}
    />
  );
}

/** Glass shows what's inside a Backdrop. Put the Backdrop behind the glass, not around it. */
export function Backdrop(props: BackdropProps) {
  return <NativeBackdrop collapsable={false} {...props} />;
}

/** Holds glass that flows together. On Android the shapes don't merge yet. */
export function GlassGroup({ spacing: _spacing, ...props }: GlassGroupProps) {
  return <View {...props} />;
}

/** Whether this is Apple's Liquid Glass. On Android the glass is this package's own. */
export const isLiquidGlassAvailable = () => false;
