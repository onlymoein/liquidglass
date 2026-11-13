import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Picker, PickerGroup } from "../src";
import { ORDER } from "../src/styles/order";

const ROW = 34; // what the wheel measures when it can't lay anything out, as here

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => ({ value: label.toLowerCase(), label }));
const fruit = ["Apple", "Apricot", "Banana", "Cherry"].map((label) => ({ value: label.toLowerCase(), label }));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const wheel = (name: string) => screen.getByRole("listbox", { name });
const chosen = (name: string) => screen.getAllByRole("option", { selected: true }).find((option) => wheel(name).contains(option))!.textContent;

/** jsdom doesn't scroll, so the wheel's position is kept here. */
function scrollable(element: HTMLElement, top = 0) {
  let current = top;
  Object.defineProperty(element, "scrollTop", { configurable: true, get: () => current, set: (next: number) => (current = next) });
  element.scrollTo = ((options: ScrollToOptions) => (current = options.top ?? current)) as typeof element.scrollTo;
}

test("is a list of options that points at the chosen one", () => {
  render(<Picker aria-label="Day" items={days} defaultValue="wed" />);
  const list = wheel("Day");
  expect(list.tabIndex).toBe(0);
  const options = screen.getAllByRole("option");
  expect(options.map((option) => option.textContent)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  expect(options.map((option) => option.getAttribute("aria-selected"))).toEqual(["false", "false", "true", "false", "false", "false", "false"]);
  expect(list.getAttribute("aria-activedescendant")).toBe(options[2]!.id);
});

test("starts on the first row when given none, and keeps a value that isn't a row on the first", () => {
  render(<Picker aria-label="Day" items={days} />);
  expect(chosen("Day")).toBe("Mon");
  render(<Picker aria-label="Other" items={days} value="someday" />);
  expect(chosen("Other")).toBe("Mon");
});

test("sits on the chosen row from the start", () => {
  const { container } = render(<Picker aria-label="Day" items={days} defaultValue="thu" />);
  expect(container.querySelector<HTMLElement>(".lg-picker-wheel")!.scrollTop).toBe(3 * ROW);
});

test("arrow keys, Page Up and Down, Home and End move by row and stop at the ends", () => {
  const onValueChange = vi.fn();
  render(<Picker aria-label="Day" items={days} defaultValue="mon" onValueChange={onValueChange} />);
  const list = wheel("Day");
  fireEvent.keyDown(list, { key: "ArrowUp" });
  expect(onValueChange).not.toHaveBeenCalled();
  fireEvent.keyDown(list, { key: "ArrowDown" });
  expect(onValueChange).toHaveBeenLastCalledWith("tue");
  fireEvent.keyDown(list, { key: "PageDown" });
  expect(onValueChange).toHaveBeenLastCalledWith("sat");
  fireEvent.keyDown(list, { key: "End" });
  expect(onValueChange).toHaveBeenLastCalledWith("sun");
  fireEvent.keyDown(list, { key: "ArrowDown" });
  expect(onValueChange).toHaveBeenCalledTimes(3);
  fireEvent.keyDown(list, { key: "PageUp" });
  expect(onValueChange).toHaveBeenLastCalledWith("wed");
  fireEvent.keyDown(list, { key: "Home" });
  expect(onValueChange).toHaveBeenLastCalledWith("mon");
  expect(chosen("Day")).toBe("Mon");
});

test("leaves keys with a modifier to the browser", () => {
  const onValueChange = vi.fn();
  render(<Picker aria-label="Day" items={days} defaultValue="mon" onValueChange={onValueChange} />);
  expect(fireEvent.keyDown(wheel("Day"), { key: "ArrowDown", metaKey: true })).toBe(true);
  expect(onValueChange).not.toHaveBeenCalled();
});

test("typing a row's first letters goes to the next row that begins with them", () => {
  const onValueChange = vi.fn();
  render(<Picker aria-label="Fruit" items={fruit} defaultValue="banana" onValueChange={onValueChange} />);
  const list = wheel("Fruit");
  fireEvent.keyDown(list, { key: "a" });
  expect(onValueChange).toHaveBeenLastCalledWith("apple");
  // The same letter again, quickly, is the same letters, and no row begins "aa": so it stays.
  fireEvent.keyDown(list, { key: "p" });
  fireEvent.keyDown(list, { key: "r" });
  expect(onValueChange).toHaveBeenLastCalledWith("apricot");
  // Left alone, what was typed is forgotten.
  act(() => {
    vi.advanceTimersByTime(700);
  });
  fireEvent.keyDown(list, { key: "c" });
  expect(onValueChange).toHaveBeenLastCalledWith("cherry");
});

test("a space isn't typing, so a page can still take it", () => {
  const onValueChange = vi.fn();
  render(<Picker aria-label="Fruit" items={fruit} onValueChange={onValueChange} />);
  expect(fireEvent.keyDown(wheel("Fruit"), { key: " " })).toBe(true);
  expect(onValueChange).not.toHaveBeenCalled();
});

test("a tap on a row chooses it", () => {
  const onValueChange = vi.fn();
  render(<Picker aria-label="Day" items={days} defaultValue="mon" onValueChange={onValueChange} />);
  fireEvent.click(screen.getByRole("option", { name: "Fri" }));
  expect(onValueChange).toHaveBeenCalledWith("fri");
  expect(chosen("Day")).toBe("Fri");
});

test("takes its value from the page when controlled, and doesn't move until the page says", () => {
  const onValueChange = vi.fn();
  const { rerender } = render(<Picker aria-label="Day" items={days} value="tue" onValueChange={onValueChange} />);
  fireEvent.keyDown(wheel("Day"), { key: "ArrowDown" });
  expect(onValueChange).toHaveBeenCalledWith("wed");
  expect(chosen("Day")).toBe("Tue");
  rerender(<Picker aria-label="Day" items={days} value="wed" onValueChange={onValueChange} />);
  expect(chosen("Day")).toBe("Wed");
});

test("scrolls to a value the page sets", () => {
  const { container, rerender } = render(<Picker aria-label="Day" items={days} value="mon" />);
  const list = container.querySelector<HTMLElement>(".lg-picker-wheel")!;
  scrollable(list, 0);
  rerender(<Picker aria-label="Day" items={days} value="sat" />);
  expect(list.scrollTop).toBe(5 * ROW);
});

test("chooses the row the wheel comes to rest on, and not the ones it passes", () => {
  const onValueChange = vi.fn();
  const { container } = render(<Picker aria-label="Day" items={days} defaultValue="mon" onValueChange={onValueChange} />);
  const list = container.querySelector<HTMLElement>(".lg-picker-wheel")!;
  scrollable(list, 0);
  for (const row of [1, 2, 3]) {
    list.scrollTop = row * ROW + 4;
    fireEvent.scroll(list);
    act(() => {
      vi.advanceTimersByTime(40);
    });
  }
  expect(onValueChange).not.toHaveBeenCalled();
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(onValueChange).toHaveBeenCalledTimes(1);
  expect(onValueChange).toHaveBeenCalledWith("thu");
  expect(chosen("Day")).toBe("Thu");
});

test("waits for a finger to lift before choosing", () => {
  const onValueChange = vi.fn();
  const { container } = render(<Picker aria-label="Day" items={days} defaultValue="mon" onValueChange={onValueChange} />);
  const list = container.querySelector<HTMLElement>(".lg-picker-wheel")!;
  scrollable(list, 0);
  fireEvent.touchStart(list);
  list.scrollTop = 2 * ROW;
  fireEvent.scroll(list);
  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(onValueChange).not.toHaveBeenCalled();
  fireEvent.touchEnd(list);
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(onValueChange).toHaveBeenCalledWith("wed");
});

test("a scroll that ends past the last row chooses the last", () => {
  const onValueChange = vi.fn();
  const { container } = render(<Picker aria-label="Day" items={days} defaultValue="mon" onValueChange={onValueChange} />);
  const list = container.querySelector<HTMLElement>(".lg-picker-wheel")!;
  scrollable(list, 0);
  list.scrollTop = 99 * ROW;
  fireEvent(list, new Event("scrollend"));
  expect(onValueChange).toHaveBeenCalledWith("sun");
});

test("a mouse drags the wheel and settles on the nearest row", () => {
  const onValueChange = vi.fn();
  const { container } = render(<Picker aria-label="Day" items={days} defaultValue="mon" onValueChange={onValueChange} />);
  const list = container.querySelector<HTMLElement>(".lg-picker-wheel")!;
  scrollable(list, 0);
  fireEvent.pointerDown(list, { pointerId: 1, pointerType: "mouse", button: 0, clientY: 200 });
  expect(list.hasAttribute("data-dragging")).toBe(false);
  fireEvent.pointerMove(list, { pointerId: 1, pointerType: "mouse", clientY: 200 - 2.4 * ROW });
  expect(list.hasAttribute("data-dragging")).toBe(true);
  expect(list.scrollTop).toBeCloseTo(2.4 * ROW);
  fireEvent.pointerUp(list, { pointerId: 1, pointerType: "mouse" });
  expect(list.hasAttribute("data-dragging")).toBe(false);
  expect(list.scrollTop).toBe(2 * ROW);
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(onValueChange).toHaveBeenCalledWith("wed");
});

test("the click that ends a drag doesn't choose the row under the mouse", () => {
  const onValueChange = vi.fn();
  const { container } = render(<Picker aria-label="Day" items={days} defaultValue="mon" onValueChange={onValueChange} />);
  const list = container.querySelector<HTMLElement>(".lg-picker-wheel")!;
  scrollable(list, 0);
  const row = screen.getByRole("option", { name: "Sun" });
  fireEvent.pointerDown(row, { pointerId: 1, pointerType: "mouse", button: 0, clientY: 200 });
  fireEvent.pointerMove(row, { pointerId: 1, pointerType: "mouse", clientY: 200 - ROW });
  fireEvent.pointerUp(row, { pointerId: 1, pointerType: "mouse" });
  fireEvent.click(row);
  expect(onValueChange).not.toHaveBeenCalledWith("sun");
});

test("a touch is left to the browser to scroll", () => {
  const { container } = render(<Picker aria-label="Day" items={days} defaultValue="mon" />);
  const list = container.querySelector<HTMLElement>(".lg-picker-wheel")!;
  fireEvent.pointerDown(list, { pointerId: 1, pointerType: "touch", button: 0, clientY: 200 });
  expect(list.hasAttribute("data-dragging")).toBe(false);
});

test("shows an odd number of rows from three to nine", () => {
  const rows = (count?: number) => {
    const { container, unmount } = render(<Picker aria-label="Day" items={days} rows={count} />);
    const value = container.querySelector<HTMLElement>(".lg-picker")!.style.getPropertyValue("--lg-picker-rows");
    unmount();
    return value;
  };
  expect([rows(), rows(4), rows(7), rows(1), rows(20)]).toEqual(["5", "5", "7", "3", "9"]);
});

test("turns the rows round a drum, the chosen one flat and the rest tilted and dimmer", () => {
  render(<Picker aria-label="Day" items={days} defaultValue="wed" />);
  const options = screen.getAllByRole("option");
  const tilt = (option: HTMLElement) => Number(/rotateX\(([-\d.]+)deg\)/.exec(option.style.transform)![1]);
  expect(Number(options[2]!.style.opacity)).toBe(1);
  expect(Math.abs(tilt(options[2]!))).toBe(0);
  expect(tilt(options[3]!)).toBeCloseTo(-24);
  expect(tilt(options[1]!)).toBeCloseTo(24);
  expect(Number(options[3]!.style.opacity)).toBeCloseTo(0.7);
  expect(Number(options[4]!.style.opacity)).toBeCloseTo(0.4);
  // The rows come in towards the middle as they turn away.
  expect(options[3]!.style.transform).toMatch(/^translate3d\(0, -?[\d.]+px, -[\d.]+px\)/);
  // Rows right out of sight are dim to nothing.
  expect(Number(options[6]!.style.opacity)).toBe(0);
});

test("leaves rows far from the middle alone", () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ value: String(i), label: `Row ${i}` }));
  render(<Picker aria-label="Many" items={many} defaultValue="2" />);
  const options = screen.getAllByRole("option");
  expect(options[3]!.style.transform).not.toBe("");
  expect(options[30]!.style.transform).toBe("");
  expect(options[30]!.style.opacity).toBe("");
});

test("pickers in a group share it, and the group is named for what it holds", () => {
  render(
    <PickerGroup aria-label="Time">
      <Picker aria-label="Hour" items={days} />
      <Picker aria-label="Minute" items={fruit} />
    </PickerGroup>,
  );
  const group = screen.getByRole("group", { name: "Time" });
  expect(group.querySelectorAll("[role=listbox]")).toHaveLength(2);
});

test("passes other props and the ref to the list, and the class to the picker", () => {
  const ref = { current: null as HTMLDivElement | null };
  const { container } = render(<Picker ref={ref} aria-label="Day" data-x="1" className="mine" items={days} />);
  expect(ref.current).toBe(wheel("Day"));
  expect(wheel("Day").getAttribute("data-x")).toBe("1");
  expect(container.querySelector(".lg-picker")!.classList.contains("mine")).toBe(true);
});

test("a handler of the app's own still runs", () => {
  const onKeyDown = vi.fn();
  render(<Picker aria-label="Day" items={days} onKeyDown={onKeyDown} />);
  fireEvent.keyDown(wheel("Day"), { key: "ArrowDown" });
  expect(onKeyDown).toHaveBeenCalledTimes(1);
});

test("without rows, there's a list with nothing to point at", () => {
  render(<Picker aria-label="Empty" items={[]} />);
  expect(wheel("Empty").getAttribute("aria-activedescendant")).toBeNull();
  fireEvent.keyDown(wheel("Empty"), { key: "ArrowDown" });
});

test("brings its own part of the stylesheet, after the page control's", () => {
  render(<Picker aria-label="Day" items={days} />);
  const style = document.querySelector('style[data-liquidglass="picker"]')!;
  expect(style.textContent).toContain(".lg-picker-wheel");
  expect(ORDER.indexOf("picker")).toBeGreaterThan(ORDER.indexOf("page-control"));
  expect(ORDER.indexOf("picker")).toBeLessThan(ORDER.indexOf("access"));
});

test("a press that stays still doesn't hold the pointer, so its click reaches the row", () => {
  const capture = vi.spyOn(Element.prototype, "setPointerCapture");
  const onValueChange = vi.fn();
  const { container } = render(<Picker aria-label="Day" items={days} defaultValue="mon" onValueChange={onValueChange} />);
  const list = container.querySelector<HTMLElement>(".lg-picker-wheel")!;
  const row = screen.getByRole("option", { name: "Tue" });
  fireEvent.pointerDown(row, { pointerId: 1, pointerType: "mouse", button: 0, clientY: 200 });
  fireEvent.pointerMove(row, { pointerId: 1, pointerType: "mouse", clientY: 201 });
  fireEvent.pointerUp(row, { pointerId: 1, pointerType: "mouse" });
  expect(capture).not.toHaveBeenCalled();
  expect(list.hasAttribute("data-dragging")).toBe(false);
  fireEvent.click(row);
  expect(onValueChange).toHaveBeenCalledWith("tue");
  capture.mockRestore();
});

test("a drag goes on when the pointer can't be held", () => {
  const capture = vi.spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {
    throw new DOMException("No active pointer", "NotFoundError");
  });
  const onValueChange = vi.fn();
  const { container } = render(<Picker aria-label="Day" items={days} defaultValue="mon" onValueChange={onValueChange} />);
  const list = container.querySelector<HTMLElement>(".lg-picker-wheel")!;
  scrollable(list, 0);
  fireEvent.pointerDown(list, { pointerId: 1, pointerType: "mouse", button: 0, clientY: 200 });
  fireEvent.pointerMove(list, { pointerId: 1, pointerType: "mouse", clientY: 200 - 2 * ROW });
  expect(list.scrollTop).toBe(2 * ROW);
  fireEvent.pointerUp(list, { pointerId: 1, pointerType: "mouse" });
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(onValueChange).toHaveBeenCalledWith("wed");
  capture.mockRestore();
});
