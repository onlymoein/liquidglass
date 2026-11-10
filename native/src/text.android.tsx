import { createContext, forwardRef, useContext, type ElementRef } from 'react';
import { StyleSheet, Text as Base, type TextProps, type TextStyle } from 'react-native';

// San Francisco is Apple's, and only for Apple's systems, so on Android text is set in Inter, an
// open typeface close to it. The package carries Inter in Text and Display cuts, as iOS switches
// from SF Text to SF Display at 20 points. Inter's capitals stand a little taller, so it's set a
// touch smaller, and then spaced so a line runs as long as it would on an iPhone: the spacing
// below was measured against San Francisco with Apple's tracking at each size.

/** Inter's capitals are this much taller than San Francisco's at the same size. */
const SCALE = 0.969;

const TEXT_SIZES = [11, 13, 15, 17];
const DISPLAY_SIZES = [20, 22, 28, 34];
const SPACING: Record<number, { text: number[]; display: number[] }> = {
  400: { text: [0.202, 0.087, -0.037, -0.211], display: [0.31, 0.201, 0.191, 0.171] },
  500: { text: [0.262, 0.159, 0.046, -0.117], display: [0.353, 0.261, 0.293, 0.295] },
  600: { text: [0.323, 0.231, 0.129, -0.023], display: [0.395, 0.318, 0.392, 0.415] },
  700: { text: [0.386, 0.305, 0.214, 0.073], display: [0.437, 0.378, 0.496, 0.54] },
};
const CUTS: Record<number, string> = { 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold' };

function weightOf(weight: TextStyle['fontWeight']): number {
  const w = weight === 'bold' ? 700 : weight === 'normal' || weight == null ? 400 : Number(weight);
  if (!Number.isFinite(w)) return 400;
  return w >= 700 ? 700 : w >= 600 ? 600 : w >= 500 ? 500 : 400;
}

function between(sizes: number[], values: number[], size: number): number {
  if (size <= sizes[0]!) return values[0]!;
  for (let i = 1; i < sizes.length; i++) {
    if (size <= sizes[i]!) {
      const t = (size - sizes[i - 1]!) / (sizes[i]! - sizes[i - 1]!);
      return values[i - 1]! + (values[i]! - values[i - 1]!) * t;
    }
  }
  // Past the table, spacing grows with the size.
  return (values[values.length - 1]! * size) / sizes[sizes.length - 1]!;
}

/** The style that sets Android text as San Francisco would set it at this size and weight. */
export function systemFont(size: number, weight?: TextStyle['fontWeight']): TextStyle {
  const w = weightOf(weight);
  const display = size >= 20;
  const spacing = display ? between(DISPLAY_SIZES, SPACING[w]!.display, size) : between(TEXT_SIZES, SPACING[w]!.text, size);
  return {
    fontFamily: `Inter${display ? 'Display' : ''}-${CUTS[w]}`,
    // Each weight is its own file, so Android mustn't embolden it again.
    fontWeight: 'normal',
    fontSize: size * SCALE,
    letterSpacing: spacing,
  };
}

// Text inside text takes its size and weight from around it.
const Around = createContext<{ size: number; weight: TextStyle['fontWeight'] }>({ size: 14, weight: '400' });

/**
 * Text in the system's typeface: San Francisco on iOS, and on Android Inter, sized and spaced to
 * match. A fontFamily of your own wins.
 */
export const Text: typeof Base = forwardRef<ElementRef<typeof Base>, TextProps>(function Text({ style, ...props }, ref) {
  const around = useContext(Around);
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return <Base ref={ref} style={style} {...props} />;
  const size = flat.fontSize ?? around.size;
  const weight = flat.fontWeight ?? around.weight;
  const font = systemFont(size, weight);
  const spaced = flat.letterSpacing == null ? font : { ...font, letterSpacing: (font.letterSpacing ?? 0) + flat.letterSpacing };
  return (
    <Around.Provider value={{ size, weight }}>
      <Base ref={ref} {...props} style={[style, spaced]} />
    </Around.Provider>
  );
}) as unknown as typeof Base;
