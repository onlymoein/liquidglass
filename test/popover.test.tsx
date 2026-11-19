import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { Popover } from "../src";

const trigger = () => screen.getByRole("button", { name: "Colour" });
const card = () => screen.getByRole("dialog", { name: "Colour" });

function sized(sizes: { card: [number, number]; trigger: [number, number, number, number] }) {
  // jsdom lays nothing out: stand in for the sizes and the trigger's place.
  const width = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("lg-popover-card") ? sizes.card[0] : this.classList.contains("lg-button") ? sizes.trigger[2] : 0;
  });
  const height = vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("lg-popover-card") ? sizes.card[1] : this.classList.contains("lg-button") ? sizes.trigger[3] : 0;
  });
  const rect = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const [left, top, w, h] = this.classList.contains("lg-button") ? sizes.trigger : [0, 0, 0, 0];
    return { left, top, width: w, height: h, right: left + w, bottom: top + h, x: left, y: top, toJSON() {} };
  });
  return () => [width, height, rect].forEach((spy) => spy.mockRestore());
}

afterEach(() => {
  vi.useRealTimers();
});

test("shows nothing until it's opened, and the trigger says what it opens", () => {
  render(
    <Popover aria-label="Colour" label="Colour">
      Pick one
    </Popover>,
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(trigger().getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger().getAttribute("aria-expanded")).toBe("false");
  expect(trigger().hasAttribute("aria-controls")).toBe(false);
});

test("opens as a named dialog the trigger points at, and starts on its first control from the keyboard", () => {
  render(
    <Popover aria-label="Colour" label="Colour">
      <p>Pick one</p>
      <button>Red</button>
      <button>Blue</button>
    </Popover>,
  );
  fireEvent.click(trigger());
  expect(card().id).toBe(trigger().getAttribute("aria-controls"));
  expect(trigger().getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("Pick one")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Red" }));
});

test("takes focus itself when a pointer opened it, so nothing comes up ringed", () => {
  render(
    <Popover aria-label="Colour" label="Colour">
      <button>Red</button>
    </Popover>,
  );
  fireEvent.pointerDown(trigger());
  fireEvent.click(trigger(), { detail: 1 });
  expect(document.activeElement).toBe(card());
});

test("takes focus itself when there is nothing in it to focus", () => {
  render(
    <Popover aria-label="Colour" label="Colour">
      Just words
    </Popover>,
  );
  fireEvent.click(trigger());
  expect(document.activeElement).toBe(card());
});

test("closes on Escape, returns focus to the trigger and leaves after animating out", () => {
  vi.useFakeTimers();
  render(
    <Popover aria-label="Colour" label="Colour">
      <button>Red</button>
    </Popover>,
  );
  fireEvent.click(trigger());
  fireEvent.keyDown(screen.getByRole("button", { name: "Red" }), { key: "Escape" });
  expect(card().dataset.phase).toBe("leaving");
  expect(document.activeElement).toBe(trigger());
  act(() => {
    vi.advanceTimersByTime(250);
  });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("closes on a press outside, but not on one inside or on the trigger", () => {
  const onOpenChange = vi.fn();
  render(
    <>
      <p>Elsewhere</p>
      <Popover aria-label="Colour" label="Colour" onOpenChange={onOpenChange}>
        <button>Red</button>
      </Popover>
    </>,
  );
  fireEvent.click(trigger());
  onOpenChange.mockClear();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Red" }));
  fireEvent.pointerDown(trigger());
  expect(onOpenChange).not.toHaveBeenCalled();
  fireEvent.pointerDown(screen.getByText("Elsewhere"));
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});

test("pressing the trigger again closes it", () => {
  render(
    <Popover aria-label="Colour" label="Colour">
      Pick one
    </Popover>,
  );
  fireEvent.click(trigger());
  fireEvent.pointerDown(trigger());
  fireEvent.click(trigger(), { detail: 1 });
  expect(card().dataset.phase).toBe("leaving");
});

test("closes when focus moves on to something else, but not to the trigger", () => {
  const onOpenChange = vi.fn();
  render(
    <>
      <Popover aria-label="Colour" label="Colour" onOpenChange={onOpenChange}>
        <button>Red</button>
        <button>Blue</button>
      </Popover>
      <button>Next</button>
    </>,
  );
  fireEvent.click(trigger());
  onOpenChange.mockClear();
  fireEvent.focusOut(screen.getByRole("button", { name: "Red" }), { relatedTarget: screen.getByRole("button", { name: "Blue" }) });
  fireEvent.focusOut(screen.getByRole("button", { name: "Red" }), { relatedTarget: trigger() });
  expect(onOpenChange).not.toHaveBeenCalled();
  fireEvent.focusOut(screen.getByRole("button", { name: "Blue" }), { relatedTarget: screen.getByRole("button", { name: "Next" }) });
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});

test("asks its owner to open and close, and stays open until it agrees", () => {
  const onOpenChange = vi.fn();
  const { rerender } = render(
    <Popover aria-label="Colour" label="Colour" open={false} onOpenChange={onOpenChange}>
      Pick one
    </Popover>,
  );
  fireEvent.click(trigger());
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  expect(screen.queryByRole("dialog")).toBeNull();

  rerender(
    <Popover aria-label="Colour" label="Colour" open onOpenChange={onOpenChange}>
      Pick one
    </Popover>,
  );
  fireEvent.keyDown(card(), { key: "Escape" });
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(card().dataset.phase).toBe("open");
});

test("reports each change once", () => {
  const onOpenChange = vi.fn();
  render(
    <Popover aria-label="Colour" label="Colour" defaultOpen onOpenChange={onOpenChange}>
      Pick one
    </Popover>,
  );
  fireEvent.keyDown(card(), { key: "Escape" });
  fireEvent.pointerDown(document.body);
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});

test("names an icon-only trigger", () => {
  render(
    <Popover aria-label="Colour" icon={<svg />}>
      Pick one
    </Popover>,
  );
  expect(trigger().textContent).toBe("");
});

test("draws an arrow unless told not to", () => {
  const { unmount } = render(
    <Popover aria-label="Colour" label="Colour" defaultOpen>
      Pick one
    </Popover>,
  );
  expect(document.querySelector(".lg-popover-arrow")).toBeTruthy();
  expect(document.querySelector(".lg-popover-arrow-rim")).toBeTruthy();
  unmount();
  render(
    <Popover aria-label="Colour" label="Colour" arrow={false} defaultOpen>
      Pick one
    </Popover>,
  );
  expect(document.querySelector(".lg-popover-arrow")).toBeNull();
  expect(card().hasAttribute("data-arrow")).toBe(false);
  expect(card().style.getPropertyValue("--lg-popover-arrow")).toBe("");
});

test("is set below its trigger with its arrow pointing at the trigger's centre", () => {
  const restore = sized({ card: [260, 180], trigger: [170, 100, 60, 40] });
  render(
    <Popover aria-label="Colour" label="Colour" defaultOpen>
      Pick one
    </Popover>,
  );
  expect(card().dataset.side).toBe("bottom");
  expect(card().style.left).toBe("70px");
  expect(card().style.top).toBe("153px");
  expect(card().style.getPropertyValue("--lg-popover-arrow")).toBe("130px");
  // It opens out of the arrow's tip, 13 points above its top edge.
  expect(card().style.transformOrigin).toBe("130px -13px");
  restore();
});

test("goes above a trigger near the bottom of the window", () => {
  const restore = sized({ card: [260, 180], trigger: [170, 700, 60, 40] });
  render(
    <Popover aria-label="Colour" label="Colour" defaultOpen>
      Pick one
    </Popover>,
  );
  expect(card().dataset.side).toBe("top");
  expect(card().style.top).toBe(`${700 - 13 - 180}px`);
  expect(card().style.transformOrigin).toBe("130px 193px");
  restore();
});

test("scrolls its content when it's taller than the room", () => {
  const restore = sized({ card: [260, 2000], trigger: [170, 100, 60, 40] });
  render(
    <Popover aria-label="Colour" label="Colour" defaultOpen>
      Pick one
    </Popover>,
  );
  expect(card().hasAttribute("data-scrolls")).toBe(true);
  expect(document.querySelector<HTMLElement>(".lg-popover-content")!.style.maxHeight).toBe(`${768 - 8 - 153}px`);
  restore();
});

test("stays beside its trigger when its side or alignment changes while open", () => {
  const restore = sized({ card: [260, 180], trigger: [170, 400, 60, 40] });
  const { rerender } = render(
    <Popover aria-label="Colour" label="Colour" defaultOpen>
      Pick one
    </Popover>,
  );
  expect(card().dataset.side).toBe("bottom");
  rerender(
    <Popover aria-label="Colour" label="Colour" side="top" align="start" defaultOpen>
      Pick one
    </Popover>,
  );
  expect(card().dataset.side).toBe("top");
  expect(card().style.left).toBe("170px");
  restore();
});

test("brings in only its own styles with the button's", () => {
  render(
    <Popover aria-label="Colour" label="Colour">
      Pick one
    </Popover>,
  );
  const parts = [...document.querySelectorAll("style[data-liquidglass]")].map((style) => style.getAttribute("data-liquidglass"));
  expect(parts).toContain("popover");
  expect(parts).toContain("button");
  expect(parts).not.toContain("menu");
  expect(document.querySelector('style[data-liquidglass="popover"]')!.textContent).toContain(".lg-popover-card");
});
