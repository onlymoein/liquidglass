import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useColorScheme, View, type ViewProps } from 'react-native';

import type { BackdropProps, GlassGroupProps, GlassProps } from './types';

const available = isLiquidGlassAvailable();

/**
 * A pane of Liquid Glass. On iOS 26 and later it's the system's own glass, which bends and lights
 * what's behind it. Elsewhere it's a translucent pane, so the layout is the same.
 */
export function Glass({ variant = 'regular', tint, interactive, colorScheme = 'auto', style, ...props }: GlassProps) {
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

export type LensProps = ViewProps & { zoom?: number; split?: number };

/** The clear lens of a held thumb. Here it's clear glass; on Android it also bends and enlarges. */
export function Lens({ zoom: _zoom, split: _split, ...props }: LensProps) {
  return <Glass variant="clear" {...props} />;
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
