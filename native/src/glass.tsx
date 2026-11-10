import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useColorScheme, View, type ColorValue, type ViewProps } from 'react-native';

import type { BackdropProps, GlassGroupProps, GlassProps } from './types';

const available = isLiquidGlassAvailable();

/**
 * A pane of Liquid Glass. On iOS 26 and later it's the system's own glass, which bends and lights
 * what's behind it. Elsewhere it's a translucent pane, so the layout is the same.
 */
export function Glass({ variant = 'regular', tint, interactive, colorScheme = 'auto', style, held: _held, touch: _touch, outermost: _outermost, growFrom: _growFrom, open: _open, onFolded: _onFolded, still: _still, stays: _stays, ...props }: GlassProps & Held & Outermost) {
  const system = useColorScheme();
  if (available) {
    return (
      <GlassView
        glassEffectStyle={variant}
        tintColor={tint}
        isInteractive={interactive}
        colorScheme={colorScheme}
        style={style}
        {...props}
      />
    );
  }
  const dark = colorScheme === 'auto' ? system === 'dark' : colorScheme === 'dark';
  return (
    <View
      style={[
        {
          backgroundColor: dark ? 'rgba(40,40,44,0.72)' : 'rgba(255,255,255,0.72)',
          borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.6)',
          borderWidth: 0.5,
        },
        style,
      ]}
      {...props}
    />
  );
}

export type LensProps = ViewProps & { zoom?: number; split?: number; frosted?: boolean };

/** The clear lens of a held thumb. Here it's clear glass; on Android it also bends and enlarges. */
export function Lens({ zoom: _zoom, split: _split, frosted, ...props }: LensProps) {
  return <Glass variant={frosted ? 'regular' : 'clear'} {...props} />;
}

/** For a menu's glass. Only Android's grows and folds; here it's a pane. */
export interface Outermost {
  outermost?: boolean;
  growFrom?: number[];
  open?: boolean;
  onFolded?: () => void;
  /** What's behind won't change while it's up: it bends a picture of it, taken once. */
  still?: boolean;
  /** Starts as `open` says and stays in sight folded. */
  stays?: boolean;
}

/** A tab bar's selection at rest. Here, a faint grey. */
export function SelectionGlass({ style, ...props }: ViewProps) {
  const dark = useColorScheme() === 'dark';
  return <View style={[{ backgroundColor: dark ? 'rgba(0,0,0,0.32)' : 'rgba(120,120,128,0.14)' }, style]} {...props} />;
}

/** A filled button's face. iOS draws its own filled buttons; elsewhere it's the plain colour. */
export interface Held {
  held?: boolean;
  touch?: { x: number; y: number } | null;
}

export function FilledGlass({ colour, style, held: _held, touch: _touch, ...props }: ViewProps & Held & { colour: ColorValue }) {
  return <View style={[{ backgroundColor: colour }, style]} {...props} />;
}

/** Holds glass that flows together, as iOS 26 glass does when two shapes come close. */
export function GlassGroup({ spacing, ...props }: GlassGroupProps) {
  if (available) return <GlassContainer spacing={spacing} {...props} />;
  return <View {...props} />;
}

/**
 * What glass shows. iOS glass sees whatever is behind it, so here this is a plain view; on
 * Android, glass can only show what's inside a Backdrop. Put it behind the glass, not around it.
 */
export function Backdrop(props: BackdropProps) {
  return <View {...props} />;
}

export { isLiquidGlassAvailable };
