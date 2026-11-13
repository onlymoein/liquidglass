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

/** The arrow of a popover: how wide its base is and how far it reaches, in points. */
export const ARROW = { width: 28, height: 10 };

/** How far an arrowless popover stands from its trigger. */
const DISTANCE = 8;

/** A little air between an arrow's tip and its trigger. */
const TIP_GAP = 3;

export interface PopoverPlacement {
  left: number;
  top: number;
  /** Which side of the trigger the popover is on. */
  side: "bottom" | "top";
  /** The popover's height once placed: its own, or the room there is, when that's less. */
  height: number;
  /** Whether the popover is taller than the room, so its content scrolls. */
  scrolls: boolean;
  /** Where the arrow's centre is along the popover's width, or `null` when it has no arrow. */
  arrow: number | null;
  /** How far the popover's near edge stands from the trigger, the arrow's reach included. */
  distance: number;
}

/**
 * Where a popover goes, given its trigger and its own size.
 *
 * As on iOS, it stands clear of its trigger on the side it was asked for, or, when there isn't
 * room, on the other one, or on whichever has more if neither fits, where its content scrolls.
 * It lines up with the trigger's centre or edge, then moves in from the window's edge if it
 * would cross it. Its arrow points at the trigger's centre for as long as there's room for the
 * arrow along the popover's edge, clear of the rounded corners.
 */
export function placePopover(
  trigger: Rect,
  popover: { width: number; height: number },
  options: { side: "auto" | "bottom" | "top"; align: "start" | "center" | "end"; arrow: boolean; corner?: number },
  viewport: { width: number; height: number },
): PopoverPlacement {
  const distance = options.arrow ? ARROW.height + TIP_GAP : DISTANCE;
  const lined =
    options.align === "end"
      ? trigger.left + trigger.width - popover.width
      : options.align === "center"
        ? trigger.left + (trigger.width - popover.width) / 2
        : trigger.left;
  const left = Math.max(EDGE, Math.min(lined, viewport.width - EDGE - popover.width));
  const below = Math.max(0, viewport.height - EDGE - (trigger.top + trigger.height + distance));
  const above = Math.max(0, trigger.top - distance - EDGE);
  const fits = (side: "bottom" | "top") => popover.height <= (side === "bottom" ? below : above);
  const wanted = options.side === "top" ? "top" : "bottom";
  const other = wanted === "top" ? "bottom" : "top";
  const side = fits(wanted) ? wanted : fits(other) ? other : below >= above ? "bottom" : "top";
  const room = side === "bottom" ? below : above;
  const height = Math.min(popover.height, room);
  const top = side === "bottom" ? trigger.top + trigger.height + distance : trigger.top - distance - height;
  let arrow: number | null = null;
  if (options.arrow) {
    const reach = Math.min((options.corner ?? 28) + ARROW.width / 2, popover.width / 2);
    arrow = Math.max(reach, Math.min(trigger.left + trigger.width / 2 - left, popover.width - reach));
  }
  return { left, top, side, height, scrolls: popover.height > room, arrow, distance };
}
