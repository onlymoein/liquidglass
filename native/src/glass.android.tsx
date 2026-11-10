import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import { Animated, StyleSheet, useColorScheme, View, type ColorValue, type ViewProps } from 'react-native';

import { native, sayMissing } from './native';
import { OverlayHost } from './overlay';
import { usePress } from './press';
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
  prominent?: boolean;
  held?: boolean;
  touch?: number[];
  zoom?: number;
  split?: number;
  outermost?: boolean;
  growFrom?: number[];
  open?: boolean;
  onFolded?: () => void;
  still?: boolean;
  onBackdropMissing?: () => void;
};

let toldBackdrop = false;
/** Says once, in development, that glass has nothing behind it to show. */
const sayNoBackdrop = () => {
  if (!__DEV__ || toldBackdrop) return;
  toldBackdrop = true;
  console.warn(
    '@onlymoein/liquidglass-native: glass on Android found no Backdrop behind it, so it shows a ' +
      "plain pane. An Android view can't see what's drawn behind it: wrap what the glass should " +
      'show in a <Backdrop>, and keep the glass itself outside that Backdrop, as a later sibling ' +
      'of it or of one of its parents.'
  );
};
/** Without the package's native code, a translucent pane where the glass would be. */
function StandIn({ cornerRadius, outermost: _outermost, growFrom: _growFrom, open: _open, onFolded: _onFolded, still: _still, clear: _clear, dark, tint, lens, prominent, held: _held, touch: _touch, zoom: _zoom, split: _split, style, ...props }: NativeGlassProps) {
  sayMissing();
  const fill = lens ? 'transparent' : (tint ?? (dark ? 'rgba(40,40,44,0.72)' : 'rgba(255,255,255,0.72)'));
  return <View {...props} style={[{ backgroundColor: prominent ? (tint ?? fill) : fill, borderRadius: cornerRadius }, style]} />;
}

const NativeGlass: ComponentType<NativeGlassProps> = native ? requireNativeView('LiquidGlass', 'GlassView') : StandIn;
const PressableGlass = Animated.createAnimatedComponent(NativeGlass);

/** For a control that handles the press itself and lights its glass while it's held. */
export interface Held {
  held?: boolean;
  touch?: { x: number; y: number } | null;
}
/** For a menu's glass, over the whole page. */
export interface Outermost {
  /** Shows the whole page behind it, not just what's nearest. */
  outermost?: boolean;
  /** Grows out of this, in points from where it's laid out: left, top, width, height. */
  growFrom?: number[];
  /** False to fold it back into where it grew from. */
  open?: boolean;
  onFolded?: () => void;
  /** What's behind won't change while it's up: it bends a picture of it, taken once. */
  still?: boolean;
}
const at = (touch: Held['touch']) => (touch ? [touch.x, touch.y] : undefined);
const NativeBackdrop: ComponentType<ViewProps> = native ? requireNativeView('LiquidGlass', 'BackdropView') : View;
const NativeGroup: ComponentType<ViewProps & { spacing: number }> = native
  ? requireNativeView('LiquidGlass', 'GlassGroupView')
  : ({ spacing: _spacing, ...props }: ViewProps & { spacing: number }) => <View {...props} />;

export function Glass({
  variant = 'regular',
  tint,
  interactive = false,
  colorScheme = 'auto',
  style,
  held,
  touch,
  ...props
}: GlassProps & Held & Outermost) {
  const system = useColorScheme();
  const dark = colorScheme === 'auto' ? system === 'dark' : colorScheme === 'dark';
  const radius = StyleSheet.flatten(style)?.borderRadius;
  const press = usePress(interactive, props.onLayout);
  const common = {
    cornerRadius: typeof radius === 'number' ? radius : 0,
    clear: variant === 'clear',
    dark,
    tint,
  };
  // Interactive glass answers a finger as iOS's does: it grows, follows it and lights up.
  if (interactive) {
    return (
      <PressableGlass
        onBackdropMissing={sayNoBackdrop}
        {...props}
        {...press.handlers}
        ref={press.ref as never}
        style={[style, { transform: press.transform }]}
        {...common}
        held={press.held}
        touch={at(press.touch)}
      />
    );
  }
  return <NativeGlass onBackdropMissing={sayNoBackdrop} {...props} style={style} {...common} held={held} touch={at(touch)} />;
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
      onBackdropMissing={sayNoBackdrop}
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

/** A filled button's glass: its colour, darkened a little by what's behind, as on iOS. */
export function FilledGlass({ colour, style, held, touch, ...props }: ViewProps & Held & { colour: ColorValue }) {
  const radius = StyleSheet.flatten(style)?.borderRadius;
  return (
    <NativeGlass
      onBackdropMissing={sayNoBackdrop}
      {...props}
      held={held}
      touch={at(touch)}
      style={style}
      cornerRadius={typeof radius === 'number' ? radius : 0}
      clear={false}
      dark={false}
      tint={colour}
      prominent
    />
  );
}

/**
 * Glass shows what's inside a Backdrop. Put the Backdrop behind the glass, not around it. The
 * outermost one also holds the layer menus open on, over everything it holds.
 */
export function Backdrop(props: BackdropProps) {
  return (
    <OverlayHost>
      <NativeBackdrop collapsable={false} {...props} />
    </OverlayHost>
  );
}

/**
 * Holds glass that flows together: the glass directly inside is drawn as one surface, and pieces
 * closer than `spacing` merge, then part again as they move away.
 */
export function GlassGroup({ spacing = 20, ...props }: GlassGroupProps) {
  return <NativeGroup collapsable={false} spacing={spacing} {...props} />;
}

/** Whether this is Apple's Liquid Glass. On Android the glass is this package's own. */
export const isLiquidGlassAvailable = () => false;
