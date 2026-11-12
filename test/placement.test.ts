import { describe, expect, test } from "vitest";

import { EDGE, placeMenu, placePopover } from "../src/internal/placement";

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

describe("placePopover", () => {
  const card = { width: 260, height: 180 };
  const none = { side: "auto", align: "center", arrow: false } as const;
  const arrowed = { side: "auto", align: "center", arrow: true } as const;

  test("stands below its trigger, centred, clear of it by its arrow's reach", () => {
    const place = placePopover({ left: 170, top: 100, width: 60, height: 40 }, card, arrowed, screen);
    // The arrow is 10 tall and keeps 3 from the trigger.
    expect(place).toEqual({ left: 70, top: 153, side: "bottom", height: 180, scrolls: false, arrow: 130, distance: 13 });
  });

  test("floats a little further off without an arrow", () => {
    const place = placePopover({ left: 170, top: 100, width: 60, height: 40 }, card, none, screen);
    expect(place.top).toBe(148);
    expect(place.arrow).toBeNull();
  });

  test("lines up with the leading or trailing edge when asked", () => {
    const trigger = { left: 100, top: 100, width: 40, height: 40 };
    expect(placePopover(trigger, card, { ...none, align: "start" }, screen).left).toBe(100);
    // Its trailing edge on the trigger's, which would put it off the window: it moves in.
    expect(placePopover(trigger, card, { ...none, align: "end" }, screen).left).toBe(EDGE);
    expect(placePopover({ ...trigger, left: 300 }, card, { ...none, align: "end" }, screen).left).toBe(340 - 260);
  });

  test("goes above its trigger when there isn't room below", () => {
    const place = placePopover({ left: 170, top: 650, width: 60, height: 40 }, card, arrowed, screen);
    expect(place.side).toBe("top");
    expect(place.top).toBe(650 - 13 - 180);
  });

  test("opens above when asked, and below when there's no room above", () => {
    expect(placePopover({ left: 170, top: 400, width: 60, height: 40 }, card, { ...arrowed, side: "top" }, screen).side).toBe("top");
    expect(placePopover({ left: 170, top: 100, width: 60, height: 40 }, { width: 260, height: 300 }, { ...arrowed, side: "top" }, screen).side).toBe(
      "bottom",
    );
  });

  test("points its arrow at the trigger's centre, but never round a corner", () => {
    // A trigger far to one side of the popover, which the window has moved in.
    const near = placePopover({ left: 0, top: 100, width: 40, height: 40 }, card, arrowed, screen);
    expect(near.left).toBe(EDGE);
    expect(near.arrow).toBe(28 + 14);
    const far = placePopover({ left: 360, top: 100, width: 40, height: 40 }, card, arrowed, screen);
    expect(far.arrow).toBe(260 - (28 + 14));
  });

  test("keeps its arrow inside a popover too narrow for the corners", () => {
    const place = placePopover({ left: 170, top: 100, width: 60, height: 40 }, { width: 40, height: 40 }, arrowed, screen);
    expect(place.arrow).toBe(20);
  });

  test("takes the bigger side and scrolls when it's taller than either", () => {
    const tall = { width: 260, height: 900 };
    const low = placePopover({ left: 170, top: 600, width: 60, height: 40 }, tall, none, screen);
    expect(low.side).toBe("top");
    expect(low.scrolls).toBe(true);
    expect(low.top).toBe(EDGE);
    expect(low.height).toBe(600 - 8 - EDGE);
    const high = placePopover({ left: 170, top: 100, width: 60, height: 40 }, tall, none, screen);
    expect(high.side).toBe("bottom");
    expect(high.scrolls).toBe(true);
    expect(high.top + high.height).toBe(screen.height - EDGE);
  });
});
