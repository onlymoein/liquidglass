import type { ColorValue, ImageSourcePropType, LayoutChangeEvent, StyleProp, ViewProps, ViewStyle } from 'react-native';

/**
 * Icons are SF Symbols, named as in Apple's SF Symbols app, such as `"house.fill"`. On iOS they're
 * the system's own; elsewhere they aren't drawn, so give every control a label as well.
 */
export type SymbolName = string;

/**
 * An SF Symbol's name, or an image of the app's own, such as `require("./home.png")`. An image is
 * drawn in the control's colour, as a symbol is, so give it a transparent background.
 */
export type IconSource = SymbolName | ImageSourcePropType;

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
  icon?: IconSource;
  /** The label's typeface. See `setFontFamily` to set one for every control. */
  fontFamily?: string;
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
  /** The labels' typeface. See `setFontFamily` to set one for every control. */
  fontFamily?: string;
}

export interface TabBarItem {
  value: string;
  label: string;
  icon?: IconSource;
  /** Shown instead of `icon` while the tab is selected, such as the `.fill` version. */
  selectedIcon?: IconSource;
  /** A red badge, such as an unread count. */
  badge?: string;
  /** Finds this tab in tests. */
  testID?: string;
  /** What a screen reader says for the tab, if not its label. */
  accessibilityLabel?: string;
}

/** Where a tab is on the screen, in points from the window's top left. */
export interface TabLayout {
  value: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TabBarProps extends Base {
  items: TabBarItem[];
  /** The selected tab's `value`, or `null` for none. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  /** The colour of the selected tab. */
  tint?: ColorValue;
  /** The labels' typeface. See `setFontFamily` to set one for every control. */
  fontFamily?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
  /**
   * How much of the screen's foot the bar takes, in points, including the space below it down to
   * the screen's edge: leave this much room under content, and float buttons this far up.
   */
  onHeight?: (height: number) => void;
  /** Where each tab is on the screen, whenever that changes, for pointing one out. */
  onTabLayout?: (tabs: TabLayout[]) => void;
}
