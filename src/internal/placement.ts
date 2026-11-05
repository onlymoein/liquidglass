export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  top: number;
  /** Which way the menu grows from its trigger. */
  side: "bottom" | "top";
  /** The menu's height once placed: its own, or the room there is, when that's less. */
  height: number;
  /** Whether the menu is taller than the room, so its items scroll. */
  scrolls: boolean;
}

/** The space kept between a menu and the edges of the window. */
export const EDGE = 8;

/**
 * Where a menu goes, given its trigger and its own size.
 *
 * As on iOS, the menu covers its trigger: it starts at the trigger's top and grows down, or,
 * when there isn't room below, starts at its bottom and grows up. It centres on the trigger, or lines
 * up with its leading or trailing edge, then moves in from the window's edge if it would cross
 * it. A menu taller than either side takes the bigger one and scrolls.
 */
export function placeMenu(
  trigger: Rect,
  menu: { width: number; height: number },
  align: "start" | "center" | "end",
  viewport: { width: number; height: number },
): Placement {
  const lined =
    align === "end"
      ? trigger.left + trigger.width - menu.width
      : align === "center"
        ? trigger.left + (trigger.width - menu.width) / 2
        : trigger.left;
  const left = Math.max(EDGE, Math.min(lined, viewport.width - EDGE - menu.width));
  const below = viewport.height - EDGE - Math.max(trigger.top, EDGE);
  const above = Math.min(trigger.top + trigger.height, viewport.height - EDGE) - EDGE;
  const side = menu.height <= below || below >= above ? "bottom" : "top";
  const room = Math.max(0, side === "bottom" ? below : above);
  const height = Math.min(menu.height, room);
  const top =
    side === "bottom"
      ? Math.max(trigger.top, EDGE)
      : Math.min(trigger.top + trigger.height, viewport.height - EDGE) - height;
  return { left, top, side, height, scrolls: menu.height > room };
}
