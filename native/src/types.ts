import type { ColorValue, StyleProp, ViewProps, ViewStyle } from 'react-native';

/**
 * Icons are SF Symbols, named as in Apple's SF Symbols app, such as `"house.fill"`. On iOS they're
 * the system's own; elsewhere they aren't drawn, so give every control a label as well.
 */
export type SymbolName = string;

interface Base {
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export interface GlassProps extends ViewProps {
  /** `regular` is the frosted glass of bars and buttons; `clear` is the see-through glass over photos. */
  variant?: 'regular' | 'clear';
  /** Tints the glass, as iOS tints a primary action. */
  tint?: ColorValue;
  /** Makes the glass shimmer and swell under a finger, as an iOS glass button does. */
  interactive?: boolean;
  /** Draws the glass as light or dark whatever the system is set to. */
  colorScheme?: 'auto' | 'light' | 'dark';
}

/**
 * What glass shows, on Android. iOS glass sees whatever lies behind it, but an Android view can't,
 * so there glass shows what's inside the Backdrop drawn before it. Glass must not be inside the
 * Backdrop it shows: put the backdrop behind, as a sibling of the glass or of a parent of it.
 */
export type BackdropProps = ViewProps;

export interface GlassGroupProps extends ViewProps {
  /** Glass closer together than this flows into one shape, in points. */
  spacing?: number;
}

export interface ButtonProps extends Base {
  /** The button's text. A string child works too. */
  label?: string;
  children?: string;
  /** Shown before the label. On its own, the button is a circle; give it an `accessibilityLabel`. */
  icon?: SymbolName;
  /** `glass` is clear; `filled` fills it with the accent colour, for the primary action. */
  variant?: 'glass' | 'filled';
  /** The iOS control sizes. */
  size?: 'small' | 'regular' | 'large';
  /** Marks an action that deletes or can't be undone. Shorthand for a red `tint`. */
  destructive?: boolean;
  /** Tints a glass button's label, or a filled button's fill. */
  tint?: ColorValue;
  disabled?: boolean;
  onPress?: () => void;
}

export interface MenuItem {
  value: string;
  label: string;
  icon?: SymbolName;
  destructive?: boolean;
  disabled?: boolean;
  /** Shows a checkmark, as iOS does for the current choice. */
  checked?: boolean;
}

export interface MenuProps extends Omit<ButtonProps, 'onPress'> {
  /** What the menu offers. Tapping the button opens it, in iOS's own glass menu. */
  items: MenuItem[];
  onSelect?: (value: string) => void;
}

export interface SwitchProps extends Base {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** The colour of the track when on. iOS's green when left out. */
  tint?: ColorValue;
}

export interface SliderProps extends Base {
  value?: number;
  defaultValue?: number;
  /** Called as the thumb moves. */
  onValueChange?: (value: number) => void;
  /** Called once, when the thumb is let go. */
  onSlidingComplete?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** The colour of the filled part of the track. */
  tint?: ColorValue;
}

export interface StepperProps extends Base {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

export interface SegmentedItem {
  value: string;
  label: string;
  /** Shown instead of a label that's left empty. */
  icon?: SymbolName;
  disabled?: boolean;
}

export interface SegmentedControlProps extends Base {
  items: SegmentedItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

export interface TabBarItem {
  value: string;
  label: string;
  icon?: SymbolName;
  /** Shown instead of `icon` while the tab is selected, such as the `.fill` version. */
  selectedIcon?: SymbolName;
  /** A red badge, such as an unread count. */
  badge?: string;
}

export interface TabBarProps extends Base {
  items: TabBarItem[];
  /** The selected tab's `value`, or `null` for none. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  /** The colour of the selected tab. */
  tint?: ColorValue;
}
