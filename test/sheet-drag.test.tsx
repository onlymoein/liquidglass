import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Sheet } from "../src";
import { ownsDrag, split, whose } from "../src/internal/sheet-drag";

// jsdom's screen is 768 tall, so the sheet rests at 0.516 of it and reaches 768 - 67.
const MEDIUM = 768 * 0.516;
const LARGE = 768 - 67;

beforeEach(() => {
  // Motion is reduced, so every spring lands where it's sent and the sheet's height can be read.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  // The sheet slides down by what it's short of its resting height; that's all of its transform a test needs.
  vi.stubGlobal(
    "DOMMatrix",
    class {
      m42: number;
      constructor(transform = "") {
        this.m42 = parseFloat(/translateY\((-?[\d.]+)px/.exec(transform)?.[1] ?? "0");
      }
    },
  );
  // jsdom lays nothing out, so the sheet's box is whatever height it was last given.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const height = this.classList.contains("lg-sheet") ? parseFloat(this.style.height) || 0 : 0;
    return { height, width: 390, top: 0, left: 0, right: 390, bottom: height, x: 0, y: 0, toJSON() {} };
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sheet = () => document.querySelector<HTMLElement>(".lg-sheet")!;
const content = () => document.querySelector<HTMLElement>(".lg-sheet-content")!;
// How tall the sheet shows: below its resting height it keeps that height and slides down instead.
const height = () => parseFloat(sheet().style.height) - parseFloat(/translateY\((-?[\d.]+)px/.exec(sheet().style.transform)?.[1] ?? "0");

let time = 0;
const touch = { pointerId: 1, pointerType: "touch", isPrimary: true } as const;
const press = (target: Element, y: number) => fireEvent.pointerDown(target, { ...touch, clientX: 100, clientY: y, timeStamp: (time = 0) });
const move = (target: Element, y: number, x = 100) => fireEvent.pointerMove(target, { ...touch, clientX: x, clientY: y, timeStamp: (time += 16) });
const lift = (target: Element, y: number) => fireEvent.pointerUp(target, { ...touch, clientX: 100, clientY: y, timeStamp: (time += 16) });

// Lets the content scroll by `room` px, from where it is.
function scrollable(room: number, scrollTop = 0) {
  const node = content();
  node.style.overflowY = "auto";
  Object.defineProperty(node, "clientHeight", { configurable: true, value: 300 });
  Object.defineProperty(node, "scrollHeight", { configurable: true, value: 300 + room });
  node.scrollTop = scrollTop;
  return node;
}

test("whose drag it is: the sheet grows before the content scrolls, and the content scrolls back before the sheet shrinks", () => {
  // Up, below the tallest detent: the sheet's. At it: the content's.
  expect(whose(-20, MEDIUM, LARGE, false)).toBe("sheet");
  expect(whose(-20, LARGE, LARGE, false)).toBe("content");
  expect(whose(-20, LARGE - 0.2, LARGE, false)).toBe("content");
  // Down, with the content at its top: the sheet's. Scrolled away from it: the content's.
  expect(whose(20, LARGE, LARGE, false)).toBe("sheet");
  expect(whose(20, LARGE, LARGE, true)).toBe("content");
  expect(whose(20, MEDIUM, LARGE, true)).toBe("content");
});

test("a drag past the tallest detent scrolls the content, then resists", () => {
  expect(split(500, 700, 400)).toEqual({ height: 500, scroll: 0 });
  expect(split(800, 700, 400)).toEqual({ height: 700, scroll: 100 });
  expect(split(1200, 700, 400)).toEqual({ height: 700 + 100 / 3, scroll: 400 });
  // Content that can't scroll leaves the sheet resisting, as a drag on the handle always has.
  expect(split(790, 700, 0)).toEqual({ height: 730, scroll: 0 });
});

test("sliders, text fields and anything marked keep their own drag", () => {
  document.body.innerHTML = `<input id="a"><textarea id="b"></textarea><div role="slider" id="c"><i id="d"></i></div><div data-lg-no-sheet-drag><b id="e"></b></div><p id="f"></p><div contenteditable="false" id="g"></div>`;
  for (const id of ["a", "b", "c", "d", "e"]) expect(ownsDrag(document.getElementById(id)!), id).toBe(true);
  for (const id of ["f", "g"]) expect(ownsDrag(document.getElementById(id)!), id).toBe(false);
});

test("a drag that starts anywhere in the sheet grows it, and it settles at the nearest detent", () => {
  render(<Sheet aria-label="Details" open><p id="text">Some text</p></Sheet>);
  const text = document.getElementById("text")!;
  expect(height()).toBeCloseTo(MEDIUM);
  press(text, 600);
  move(text, 595);
  // Under the slop it isn't a drag yet.
  expect(height()).toBeCloseTo(MEDIUM);
  move(text, 560);
  move(text, 380);
  // It follows the finger from where the drag was taken, not from where it began.
  expect(height()).toBeCloseTo(MEDIUM + (560 - 380));
  lift(text, 380);
  expect(height()).toBeCloseTo(LARGE);
});

test("a drag down from the content, at its top, lets the sheet go", () => {
  const onOpenChange = vi.fn();
  render(<Sheet aria-label="Details" open onOpenChange={onOpenChange}><p id="text">Some text</p></Sheet>);
  const text = document.getElementById("text")!;
  press(text, 300);
  move(text, 320);
  move(text, 640);
  expect(height()).toBeLessThan(MEDIUM);
  lift(text, 640);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("the handle still takes a drag from the first pixel", () => {
  render(<Sheet aria-label="Details" open>Body</Sheet>);
  const handle = document.querySelector(".lg-sheet-handle")!;
  press(handle, 600);
  move(handle, 590);
  expect(height()).toBeCloseTo(MEDIUM + 10);
  lift(handle, 590);
});

test("a sideways drag, or one on a slider or a text field, leaves the sheet alone", () => {
  render(
    <Sheet aria-label="Details" open>
      <p id="text">Some text</p>
      <input aria-label="Name" id="field" />
      <div role="slider" aria-label="Volume" aria-valuenow={1} id="slider" tabIndex={0} />
    </Sheet>,
  );
  const text = document.getElementById("text")!;
  press(text, 600);
  move(text, 595, 140);
  move(text, 500, 180);
  expect(height()).toBeCloseTo(MEDIUM);
  lift(text, 500);
  for (const id of ["field", "slider"]) {
    const target = document.getElementById(id)!;
    press(target, 600);
    move(target, 500);
    move(target, 300);
    expect(height(), id).toBeCloseTo(MEDIUM);
    lift(target, 300);
  }
});

test("a tap on a button in the sheet still clicks it, and the click that ends a drag doesn't", () => {
  const onClick = vi.fn();
  render(<Sheet aria-label="Details" open><button onClick={onClick}>Save</button></Sheet>);
  const button = document.querySelector("button")!;
  press(button, 600);
  lift(button, 600);
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);

  press(button, 600);
  move(button, 560);
  move(button, 400);
  lift(button, 400);
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});

test("scrolling content: an upward drag grows the sheet first, then scrolls the content", () => {
  render(<Sheet aria-label="Details" open><p id="text">Some text</p></Sheet>);
  const node = scrollable(700);
  const text = document.getElementById("text")!;
  press(text, 700);
  move(text, 680);
  move(text, 600);
  expect(height()).toBeCloseTo(MEDIUM + 80);
  expect(node.scrollTop).toBe(0);
  // The finger has gone 380 px since the sheet took the drag, and the sheet had 304.7 left to
  // grow, so the rest of it scrolls the content.
  move(text, 300);
  expect(height()).toBeCloseTo(LARGE);
  expect(node.scrollTop).toBeCloseTo(380 - (LARGE - MEDIUM));
  // And back again, so the drag is the same whichever way it goes.
  move(text, 600);
  expect(node.scrollTop).toBe(0);
  expect(height()).toBeCloseTo(MEDIUM + 80);
  lift(text, 600);
});

test("scrolling content: at full height a drag belongs to the content, wherever it's been scrolled to", () => {
  render(<Sheet aria-label="Details" open><p id="text">Some text</p></Sheet>);
  const node = scrollable(700);
  const text = document.getElementById("text")!;
  // Grow the sheet to full height first.
  press(text, 700);
  move(text, 650);
  move(text, 100);
  lift(text, 100);
  expect(height()).toBeCloseTo(LARGE);
  node.scrollTop = 0;

  // Up: the content scrolls, which the browser does. The sheet doesn't move.
  press(text, 500);
  move(text, 480);
  move(text, 300);
  expect(height()).toBeCloseTo(LARGE);
  lift(text, 300);

  // Down, with the content scrolled away from its top: the content again.
  node.scrollTop = 120;
  press(text, 300);
  move(text, 320);
  move(text, 600);
  expect(height()).toBeCloseTo(LARGE);
  lift(text, 600);

  // Down, with the content at its top: the sheet.
  node.scrollTop = 0;
  press(text, 300);
  move(text, 320);
  move(text, 600);
  expect(height()).toBeLessThan(LARGE);
  lift(text, 600);
});

test("on a touch screen the browser's own scrolling is stopped only for a drag the sheet has taken", () => {
  render(<Sheet aria-label="Details" open><p id="text">Some text</p></Sheet>);
  const node = scrollable(700);
  const text = document.getElementById("text")!;
  const swipe = (y: number) => {
    const event = Object.assign(new Event("touchmove", { bubbles: true, cancelable: true }), { touches: [{ clientX: 100, clientY: y }] });
    text.dispatchEvent(event);
    return event.defaultPrevented;
  };
  // Below full height an upward swipe grows the sheet, so the page mustn't scroll.
  press(text, 700);
  expect(swipe(696)).toBe(false);
  expect(swipe(660)).toBe(true);
  lift(text, 660);
  // Scrolled content swiped down is the content's to scroll.
  node.scrollTop = 80;
  press(text, 300);
  expect(swipe(360)).toBe(false);
  lift(text, 360);
});

test("a mouse let go of outside the window ends the drag", () => {
  render(<Sheet aria-label="Details" open><p id="text">Some text</p></Sheet>);
  const text = document.getElementById("text")!;
  const mouse = { pointerId: 2, pointerType: "mouse", clientX: 100 } as const;
  fireEvent.pointerDown(text, { ...mouse, button: 0, buttons: 1, clientY: 600, timeStamp: 0 });
  fireEvent.pointerMove(text, { ...mouse, buttons: 1, clientY: 560, timeStamp: 16 });
  fireEvent.pointerMove(text, { ...mouse, buttons: 1, clientY: 500, timeStamp: 32 });
  expect(height()).toBeGreaterThan(MEDIUM);
  fireEvent.pointerMove(text, { ...mouse, buttons: 0, clientY: 300, timeStamp: 48 });
  const settled = height();
  fireEvent.pointerMove(text, { ...mouse, buttons: 0, clientY: 100, timeStamp: 64 });
  expect(height()).toBe(settled);
  expect(sheet().hasAttribute("data-dragging")).toBe(false);
});
