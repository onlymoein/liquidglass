import { expect, test } from "vitest";

import { EDGE, placeMenu } from "../src/internal/placement";

const screen = { width: 400, height: 800 };
const menu = { width: 220, height: 300 };

test("covers the trigger and grows down from its top, lined up with its trailing edge", () => {
  const place = placeMenu({ left: 300, top: 100, width: 40, height: 40 }, menu, "end", screen);
  expect(place).toEqual({ left: 120, top: 100, side: "bottom", height: 300, scrolls: false });
});

test("lines up with the leading edge when asked", () => {
  expect(placeMenu({ left: 20, top: 100, width: 40, height: 40 }, menu, "start", screen).left).toBe(20);
});

test("grows up from the trigger's bottom when there isn't room below", () => {
  const place = placeMenu({ left: 300, top: 700, width: 40, height: 40 }, menu, "end", screen);
  expect(place).toEqual({ left: 120, top: 440, side: "top", height: 300, scrolls: false });
});

test("moves in from the window's edge rather than cross it", () => {
  expect(placeMenu({ left: 8, top: 100, width: 40, height: 40 }, menu, "end", screen).left).toBe(EDGE);
  expect(placeMenu({ left: 360, top: 100, width: 40, height: 40 }, menu, "start", screen).left).toBe(
    screen.width - EDGE - menu.width,
  );
});

test("takes the bigger side and scrolls when it's taller than either", () => {
  const tall = { width: 220, height: 900 };
  const low = placeMenu({ left: 300, top: 600, width: 40, height: 40 }, tall, "end", screen);
  expect(low).toEqual({ left: 120, top: EDGE, side: "top", height: 640 - EDGE, scrolls: true });
  const high = placeMenu({ left: 300, top: 100, width: 40, height: 40 }, tall, "end", screen);
  expect(high).toEqual({ left: 120, top: 100, side: "bottom", height: 800 - EDGE - 100, scrolls: true });
});

test("stays on screen when its trigger has scrolled partly out of view", () => {
  const place = placeMenu({ left: 300, top: -20, width: 40, height: 40 }, menu, "end", screen);
  expect(place.top).toBe(EDGE);
  expect(place.side).toBe("bottom");
});
