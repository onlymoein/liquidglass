// A sheet moves to a drag that starts anywhere in it, as iOS's does, but its
// content may scroll, so each drag has to be given to one or the other.
//
//   - Up, with the sheet below its tallest detent: the sheet grows first, and
//     whatever is left of the drag then scrolls the content.
//   - Up, at the tallest detent: the content scrolls.
//   - Down, with the content scrolled away from its top: the content scrolls.
//   - Down, with the content at its top: the sheet shrinks, or goes away.
//
// Sideways drags, and drags that start on a slider, a text field or anything
// marked `data-lg-no-sheet-drag`, are the content's own.

/** How far, in px, a drag has to go before it's known which way it's going. */
export const SLOP = 8;

const OWN = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [draggable="true"], [data-lg-no-sheet-drag]';

/** Whether a drag that starts on `target` belongs to the thing itself, not the sheet. */
export function ownsDrag(target: Element): boolean {
  return target.closest(OWN) !== null;
}

/** Which of the elements from `target` up to `boundary` scroll up and down, innermost first. */
export function scrollers(target: Element, boundary: Element): HTMLElement[] {
  const found: HTMLElement[] = [];
  for (let node: Element | null = target; node; node = node === boundary ? null : node.parentElement) {
    if (!(node instanceof HTMLElement)) continue;
    if (/auto|scroll|overlay/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1) found.push(node);
  }
  return found;
}

/** What a drag does: `dy` is the finger's travel in px, down positive. */
export function whose(dy: number, height: number, top: number, scrolled: boolean): "sheet" | "content" {
  // The sheet takes an upward drag for as long as it can still grow.
  if (dy < 0) return height < top - 0.5 ? "sheet" : "content";
  return scrolled ? "content" : "sheet";
}

/**
 * Splits a drag's reach between the sheet and its content. `want` is the height
 * the finger asks for. The sheet stops at `top`, the content scrolls by what's
 * beyond it, up to `room`, and past that the sheet resists rather than following.
 */
export function split(want: number, top: number, room: number): { height: number; scroll: number } {
  if (want <= top) return { height: want, scroll: 0 };
  const beyond = want - top;
  const scroll = Math.min(beyond, Math.max(room, 0));
  return { height: top + (beyond - scroll) / 3, scroll };
}
