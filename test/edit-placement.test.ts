import { expect, test } from "vitest";

import { EDIT_EDGE, EDIT_GAP, paginate, placeEditMenu } from "../src/internal/edit-placement";

const screen = { width: 400, height: 800 };
const menu = { width: 200, height: 44 };

test("sits above the selection, centred on it", () => {
  const at = placeEditMenu({ left: 150, top: 300, width: 100, height: 20 }, menu, screen);
  expect(at.side).toBe("top");
  expect(at.left).toBe(100);
  expect(at.top).toBe(300 - EDIT_GAP - menu.height);
  expect(at.hidden).toBe(false);
  // It opens out of the middle of the selection, which is the middle of the menu here.
  expect(at.origin).toBe(100);
});

test("a point is a selection with no size", () => {
  const at = placeEditMenu({ left: 200, top: 300 }, menu, screen);
  expect(at.left).toBe(100);
  expect(at.top).toBe(300 - EDIT_GAP - menu.height);
});

test("moves below the selection when there isn't room above", () => {
  const at = placeEditMenu({ left: 150, top: 30, width: 100, height: 20 }, menu, screen);
  expect(at.side).toBe("bottom");
  expect(at.top).toBe(50 + EDIT_GAP);
});

test("moves in from the window's edges, and opens out of the selection all the same", () => {
  const left = placeEditMenu({ left: 0, top: 300, width: 30, height: 20 }, menu, screen);
  expect(left.left).toBe(EDIT_EDGE);
  expect(left.origin).toBe(15 - EDIT_EDGE);
  const right = placeEditMenu({ left: 380, top: 300, width: 20, height: 20 }, menu, screen);
  expect(right.left).toBe(screen.width - EDIT_EDGE - menu.width);
  expect(right.origin).toBe(390 - right.left);
});

test("the origin stays on the menu, even for a selection far from it", () => {
  const at = placeEditMenu({ left: 0, top: 300, width: 0, height: 20 }, { width: 80, height: 44 }, { width: 80, height: 800 });
  expect(at.origin).toBeGreaterThanOrEqual(0);
  expect(at.origin).toBeLessThanOrEqual(80);
});

test("covers the selection, inside the window, when there is room on neither side", () => {
  const short = { width: 400, height: 90 };
  const at = placeEditMenu({ left: 150, top: 20, width: 100, height: 50 }, menu, short);
  expect(at.side).toBe("top");
  expect(at.top).toBeGreaterThanOrEqual(EDIT_EDGE);
  expect(at.top + menu.height).toBeLessThanOrEqual(short.height - EDIT_EDGE);
});

test("is hidden once the selection has left the window", () => {
  expect(placeEditMenu({ left: 150, top: -200, width: 100, height: 20 }, menu, screen).hidden).toBe(true);
  expect(placeEditMenu({ left: 150, top: 900, width: 100, height: 20 }, menu, screen).hidden).toBe(true);
  expect(placeEditMenu({ left: 150, top: -10, width: 100, height: 20 }, menu, screen).hidden).toBe(false);
});

test("items that fit are one page, with no chevrons to make room for", () => {
  expect(paginate([80, 80, 80], 240, 40)).toEqual([[0, 1, 2]]);
  expect(paginate([], 240, 40)).toEqual([[]]);
});

test("items that don't fit are paged, each page with room for its chevrons", () => {
  // The first page has a chevron after its items, the last one before them.
  expect(paginate([100, 100, 100, 100], 284, 40)).toEqual([[0, 1], [2, 3]]);
  // One in the middle has both.
  expect(paginate([100, 100, 100, 100, 100, 100], 284, 40)).toEqual([[0, 1], [2, 3], [4, 5]]);
});

test("no page is wider than the room, chevrons included", () => {
  const widths = [120, 120, 120];
  const pages = paginate(widths, 250, 40);
  expect(pages).toEqual([[0], [1], [2]]);
  for (const [index, page] of pages.entries()) {
    const used = page.reduce((sum, item) => sum + widths[item]!, 0) + (index > 0 ? 40 : 0) + (index < pages.length - 1 ? 40 : 0);
    expect(used).toBeLessThanOrEqual(250);
  }
});

test("an item wider than the room still gets a page of its own", () => {
  expect(paginate([500, 60], 284, 40)).toEqual([[0], [1]]);
});

test("every item is on exactly one page, in order", () => {
  for (const room of [120, 200, 284, 500]) {
    const widths = [90, 60, 130, 70, 110, 95, 80];
    const pages = paginate(widths, room, 40);
    expect(pages.flat()).toEqual(widths.map((_, index) => index));
    expect(pages.every((page) => page.length > 0)).toBe(true);
  }
});
