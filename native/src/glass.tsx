import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useColorScheme, View } from 'react-native';

import type { GlassGroupProps, GlassProps } from './types';

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

/** Holds glass that flows together, as iOS 26 glass does when two shapes come close. */
export function GlassGroup({ spacing, ...props }: GlassGroupProps) {
  if (available) return <GlassContainer spacing={spacing} {...props} />;
  return <View {...props} />;
}

export { isLiquidGlassAvailable };
