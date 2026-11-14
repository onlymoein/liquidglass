/**
 * The stylesheet's parts, in the order they're written in. Each component brings the parts it
 * needs, and they go into the page in this order whichever comes first, so the cascade is the
 * stylesheet's. `dist/styles.css` is all of them, joined in this order.
 */
export const ORDER: readonly string[] = [
  "base",
  "button",
  "tab-bar",
  "input",
  "thumb",
  "switch",
  "slider",
  "menu",
  "toolbar",
  "navigation-bar",
  "sidebar",
  "glass-group",
  "segmented-control",
  "stepper",
  "page-control",
  "progress",
  "layer",
  "alert",
  "context-menu",
  "sheet",
  "popup",
  "access",
];
