import { requireNativeView } from 'expo';
import { forwardRef, type ComponentType, type ElementRef } from 'react';
import { ScrollView as Base, StyleSheet, type ScrollViewProps, type ViewProps, type ViewStyle } from 'react-native';

import { native } from './native';

const Bounce: ComponentType<ViewProps> | null = native ? requireNativeView('LiquidGlass', 'BounceView') : null;

// What places the scroll view among its neighbours goes on the view that bounces it; the rest,
// such as its background and padding, stays on the scroll view.
const OUTSIDE = new Set([
  'position', 'top', 'right', 'bottom', 'left', 'start', 'end', 'inset', 'insetBlock', 'insetInline',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'marginStart', 'marginEnd',
  'marginHorizontal', 'marginVertical', 'marginBlock', 'marginInline',
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'aspectRatio',
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'zIndex', 'display', 'transform', 'opacity',
]);

/**
 * A scroll view whose ends bounce as iOS's do, in place of Android's stretch. Horizontal scroll
 * views, and ones with a refresh control, are React Native's own.
 */
export const ScrollView: typeof Base = forwardRef<ElementRef<typeof Base>, ScrollViewProps>(function ScrollView(
  { style, horizontal, refreshControl, bounces = true, ...props },
  ref,
) {
  if (horizontal || refreshControl || !bounces || !Bounce) {
    return <Base ref={ref} style={style} horizontal={horizontal} refreshControl={refreshControl} {...props} />;
  }
  const outside: Record<string, unknown> = { flexGrow: 1, flexShrink: 1 };
  const inside: Record<string, unknown> = { flex: 1 };
  for (const [key, value] of Object.entries(StyleSheet.flatten(style) ?? {})) {
    (OUTSIDE.has(key) ? outside : inside)[key] = value;
  }
  return (
    <Bounce style={outside as ViewStyle} collapsable={false}>
      <Base ref={ref} {...props} style={inside as ViewStyle} overScrollMode="never" nestedScrollEnabled />
    </Bounce>
  );
}) as unknown as typeof Base;
