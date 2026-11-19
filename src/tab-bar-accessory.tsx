import {
  forwardRef,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
} from "react";

import { Glass } from "./glass";
import { cx } from "./internal/cx";
import { useStyles } from "./internal/styles";
import accessoryCss from "./styles/tab-bar-accessory.css?inline";

export interface TabBarAccessoryProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * `above` is the capsule over the tab bar, as wide as the bar, where iOS puts a mini player.
   * `inline` is the compact one that sits beside the bar once it has shrunk to its current tab.
   * Switching between them eases the capsule's height and corners; moving it is up to the layout.
   */
  placement?: "above" | "inline";
}

// Not measured on an iOS 27 simulator: the 48 and 39 point heights are set by eye, the inline one
// to match the minimised tab bar's 39.

/**
 * The tab bar's bottom accessory, as in SwiftUI's `tabViewBottomAccessory`: a capsule of glass that
 * rides above the tab bar and holds a row of your own, such as a mini player's artwork, title and
 * controls. It only draws the capsule, with its content laid out in a row; the buttons inside are
 * yours, so give the group an `aria-label` that says what it is.
 */
export const TabBarAccessory: ForwardRefExoticComponent<TabBarAccessoryProps & RefAttributes<HTMLDivElement>> = /* @__PURE__ */ forwardRef<
  HTMLDivElement,
  TabBarAccessoryProps
>(function TabBarAccessory({ placement = "above", className, ...props }, ref) {
  useStyles(["tab-bar-accessory", accessoryCss]);
  return <Glass ref={ref} role="group" className={cx("lg-tab-accessory", className)} data-placement={placement === "inline" ? "inline" : undefined} {...props} />;
});
