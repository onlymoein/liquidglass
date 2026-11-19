export interface EditRect {
  left: number;
  top: number;
  width?: number;
  height?: number;
}

export interface EditPlacement {
  left: number;
  top: number;
  /** Which side of what it points at it sits on. */
  side: "top" | "bottom";
  /** Where on the menu, from its left edge, what it points at is: where it opens out of. */
  origin: number;
  /** Whether what it points at is out of the window, so it's out of sight too. */
  hidden: boolean;
}

/** The space kept between the menu and the edges of the window. */
export const EDIT_EDGE = 8;

/** The space between the menu and what it points at. */
export const EDIT_GAP = 10;

/**
 * Where the edit menu goes, given what it points at (a selection, a caret) and its own size.
 *
 * As on iOS, it sits above the selection, centred on it, and moves below when there isn't room
 * above. It moves in from the window's edges rather than cross them. With no room on either
 * side it covers the selection, held inside the window. Once the selection has scrolled out of
 * the window altogether, it's hidden.
 */
export function placeEditMenu(
  anchor: EditRect,
  menu: { width: number; height: number },
  viewport: { width: number; height: number },
): EditPlacement {
  const width = anchor.width ?? 0;
  const height = anchor.height ?? 0;
  const bottom = anchor.top + height;
  const hidden = bottom < 0 || anchor.top > viewport.height;
  const above = anchor.top - EDIT_GAP - menu.height;
  const below = bottom + EDIT_GAP;
  const fitsAbove = above >= EDIT_EDGE;
  const fitsBelow = below + menu.height <= viewport.height - EDIT_EDGE;
  const side = fitsAbove || !fitsBelow ? "top" : "bottom";
  const wanted = side === "top" ? (fitsAbove ? above : anchor.top + height / 2 - menu.height / 2) : below;
  const top = Math.max(EDIT_EDGE, Math.min(wanted, viewport.height - EDIT_EDGE - menu.height));
  const centre = anchor.left + width / 2;
  const left = Math.max(EDIT_EDGE, Math.min(centre - menu.width / 2, viewport.width - EDIT_EDGE - menu.width));
  return { left, top, side, origin: Math.max(0, Math.min(menu.width, centre - left)), hidden };
}

/**
 * Splits items into pages that fit in `room`, as the iOS edit menu does when its items don't:
 * a chevron at the end goes on to the next page, and one at the start comes back. Every page
 * holds at least one item, and the last one takes whatever is left that fits beside its back
 * chevron. Returns the items' indexes, a page at a time.
 */
export function paginate(widths: readonly number[], room: number, chevron: number): number[][] {
  const count = widths.length;
  if (count === 0) return [[]];
  const rest = (from: number) => widths.slice(from).reduce((sum, width) => sum + width, 0);
  if (rest(0) <= room) return [widths.map((_, index) => index)];
  const pages: number[][] = [];
  let at = 0;
  while (at < count) {
    const back = pages.length ? chevron : 0;
    if (rest(at) <= room - back) {
      pages.push(Array.from({ length: count - at }, (_, index) => at + index));
      break;
    }
    // Room for what's shown, and the chevron that goes on.
    const budget = room - back - chevron;
    const page: number[] = [];
    let used = 0;
    while (at < count && (page.length === 0 || used + widths[at]! <= budget)) {
      used += widths[at]!;
      page.push(at++);
    }
    pages.push(page);
  }
  return pages;
}
