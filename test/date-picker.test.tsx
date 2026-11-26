import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { DatePicker } from "../src";
import { OVERLAP, placeCalendar, weeksOf } from "../src/internal/calendar";

const dialog = () => document.querySelector("dialog")!;
const title = () => document.querySelector(".lg-date-title")!.textContent;
const day = (label: string) => screen.getByLabelText(label) as HTMLButtonElement;

// 26 November 2026, 9:41 in the morning: a Thursday.
const picked = new Date(2026, 10, 26, 9, 41, 12);

test("shows the date on a button that opens a calendar of its month", () => {
  render(<DatePicker locale="en-US" defaultValue={picked} />);
  const trigger = screen.getByRole("button", { name: "Nov 26, 2026" });
  expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(dialog().hasAttribute("open")).toBe(false);
  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.hasAttribute("data-open")).toBe(true);
  expect(dialog().hasAttribute("open")).toBe(true);
  expect(title()).toBe("November 2026");
  // The month starts on a Sunday and runs to a Monday: five weeks, and the other months' days are blank.
  expect(document.querySelectorAll(".lg-date-week")).toHaveLength(5);
  expect(document.querySelectorAll(".lg-date-day")).toHaveLength(30);
});

test("picking a day keeps its time of day and leaves the calendar open", () => {
  const onValueChange = vi.fn();
  render(<DatePicker locale="en-US" defaultValue={picked} defaultOpen onValueChange={onValueChange} />);
  fireEvent.click(day("Tuesday, November 3, 2026"));
  expect(onValueChange).toHaveBeenCalledWith(new Date(2026, 10, 3, 9, 41, 12));
  expect(dialog().dataset.phase).toBe("open");
  expect(screen.getByRole("button", { name: "Nov 3, 2026" })).toBeTruthy();
  const selected = document.querySelector('[role="gridcell"][aria-selected="true"]')!;
  expect(selected.textContent).toBe("3");
});

test("turns the month with its arrows", () => {
  render(<DatePicker locale="en-US" defaultValue={picked} defaultOpen />);
  fireEvent.click(screen.getByRole("button", { name: "Next Month" }));
  expect(title()).toBe("December 2026");
  fireEvent.click(screen.getByRole("button", { name: "Previous Month" }));
  fireEvent.click(screen.getByRole("button", { name: "Previous Month" }));
  expect(title()).toBe("October 2026");
  // August 2026 starts on a Saturday, so it takes six weeks.
  fireEvent.click(screen.getByRole("button", { name: "Previous Month" }));
  fireEvent.click(screen.getByRole("button", { name: "Previous Month" }));
  expect(title()).toBe("August 2026");
  expect(document.querySelectorAll(".lg-date-week")).toHaveLength(6);
});

test("greys out the days before min and after max, and the months past them", () => {
  render(<DatePicker locale="en-US" defaultValue={picked} defaultOpen min={new Date(2026, 10, 10, 18)} max={new Date(2026, 10, 27, 6)} />);
  expect(day("Monday, November 9, 2026").disabled).toBe(true);
  expect(day("Tuesday, November 10, 2026").disabled).toBe(false);
  expect(day("Friday, November 27, 2026").disabled).toBe(false);
  expect(day("Saturday, November 28, 2026").disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Previous Month" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Next Month" }) as HTMLButtonElement).disabled).toBe(true);
});

test("opened by a tap, takes focus itself, and the first arrow key goes to the picked day", () => {
  render(<DatePicker locale="en-US" defaultValue={picked} />);
  const trigger = screen.getByRole("button", { name: "Nov 26, 2026" });
  fireEvent.pointerDown(trigger);
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(dialog());
  fireEvent.keyDown(dialog(), { key: "ArrowDown" });
  expect(document.activeElement).toBe(day("Thursday, November 26, 2026"));
});

test("moves between days with the keys, and turns the month when they leave it", () => {
  render(<DatePicker locale="en-US" defaultValue={picked} max={new Date(2026, 11, 31)} />);
  const trigger = screen.getByRole("button", { name: "Nov 26, 2026" });
  fireEvent.keyDown(trigger, { key: "Enter" });
  fireEvent.click(trigger);
  // Opened from the keyboard, the picked day takes focus, and is the one day in the grid Tab reaches.
  expect(document.activeElement).toBe(day("Thursday, November 26, 2026"));
  expect(document.querySelectorAll('.lg-date-day[tabindex="0"]')).toHaveLength(1);
  const grid = screen.getByRole("grid");
  fireEvent.keyDown(grid, { key: "ArrowRight" });
  expect(document.activeElement).toBe(day("Friday, November 27, 2026"));
  fireEvent.keyDown(grid, { key: "ArrowDown" });
  expect(title()).toBe("December 2026");
  expect(document.activeElement).toBe(day("Friday, December 4, 2026"));
  fireEvent.keyDown(grid, { key: "Home" });
  expect(document.activeElement).toBe(day("Sunday, November 29, 2026"));
  expect(title()).toBe("November 2026");
  fireEvent.keyDown(grid, { key: "End" });
  expect(document.activeElement).toBe(day("Saturday, December 5, 2026"));
  fireEvent.keyDown(grid, { key: "PageUp" });
  expect(document.activeElement).toBe(day("Thursday, November 5, 2026"));
  // It stops at max.
  fireEvent.keyDown(grid, { key: "PageDown", shiftKey: true });
  expect(document.activeElement).toBe(day("Thursday, December 31, 2026"));
});

test("marks today", () => {
  const today = new Date();
  render(<DatePicker locale="en-US" defaultOpen />);
  const marked = document.querySelector('.lg-date-day[aria-current="date"]')!;
  expect(marked.textContent).toBe(String(today.getDate()));
  expect(marked.hasAttribute("data-today")).toBe(true);
  expect(marked.hasAttribute("data-selected")).toBe(true);
});

test("starts weeks on the day asked for, with the weekdays named in full for screen readers", () => {
  render(<DatePicker locale="en-US" defaultValue={picked} defaultOpen firstDayOfWeek={1} />);
  const headers = screen.getAllByRole("columnheader");
  expect(headers[0]!.getAttribute("aria-label")).toBe("Monday");
  expect(headers[0]!.textContent).toBe("Mon");
  expect(headers[6]!.getAttribute("aria-label")).toBe("Sunday");
  // November 2026 starts on a Sunday: the last column of its first week.
  const first = document.querySelector(".lg-date-week")!.children;
  expect(first[5]!.textContent).toBe("");
  expect(first[6]!.textContent).toBe("1");
});

test("Escape and a tap outside ask to close, and it closes after running back into the button", () => {
  vi.useFakeTimers();
  const onOpenChange = vi.fn();
  const { rerender } = render(<DatePicker locale="en-US" defaultValue={picked} open onOpenChange={onOpenChange} />);
  fireEvent(dialog(), new Event("cancel", { cancelable: true }));
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  fireEvent.click(document.querySelector(".lg-modal-scrim")!);
  expect(onOpenChange).toHaveBeenCalledTimes(2);
  rerender(<DatePicker locale="en-US" defaultValue={picked} open={false} onOpenChange={onOpenChange} />);
  expect(dialog().dataset.phase).toBe("leaving");
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(dialog().dataset.phase).toBe("closed");
  expect(screen.getByRole("button", { name: "Nov 26, 2026" }).getAttribute("aria-expanded")).toBe("false");
  vi.useRealTimers();
});

test("names the date and sends it in a form", () => {
  const { container } = render(<DatePicker locale="en-US" defaultValue={picked} aria-label="Delivery" name="delivery" />);
  expect(screen.getByRole("button", { name: "Delivery, Nov 26, 2026" })).toBeTruthy();
  expect((container.querySelector('input[name="delivery"]') as HTMLInputElement).value).toBe("2026-11-26");
});

test("can't be opened when disabled", () => {
  render(<DatePicker locale="en-US" defaultValue={picked} disabled />);
  const trigger = screen.getByRole("button", { name: "Nov 26, 2026" }) as HTMLButtonElement;
  expect(trigger.disabled).toBe(true);
});

test("lays a month out in weeks of seven, blank outside it", () => {
  const weeks = weeksOf({ year: 2026, month: 10 }, 0);
  expect(weeks).toHaveLength(5);
  expect(weeks[0]![0]!.getDate()).toBe(1);
  expect(weeks[4]![1]!.getDate()).toBe(30);
  expect(weeks[4]![2]).toBeNull();
  // February 2026 starts on a Sunday and has 28 days: four weeks exactly.
  expect(weeksOf({ year: 2026, month: 1 }, 0)).toHaveLength(4);
  expect(weeksOf({ year: 2026, month: 7 }, 0)).toHaveLength(6);
});

// iPhone 17: 402 x 874 points, the calendar 320 x 334, the date's button 128 x 36.33.
const phone = { width: 402, height: 874 };
const card = { width: 320, height: 334 };
const button = (left: number, top: number) => ({ left, top, width: 128, height: 36.33 });

test("on a phone, sits 16 points from the leading side wherever its button is", () => {
  for (const left of [16, 137, 258]) expect(placeCalendar(button(left, 200), card, phone).left).toBe(16);
  expect(placeCalendar(button(16, 200), card, phone, true).left).toBe(402 - 16 - 320);
});

test("covers 12 points of its button, on the side with more room", () => {
  const low = placeCalendar(button(16, 413), card, phone);
  expect(low.side).toBe("bottom");
  expect(low.top).toBeCloseTo(413 + 36.33 - OVERLAP);
  const high = placeCalendar(button(16, 470), card, phone);
  expect(high.side).toBe("top");
  expect(high.top).toBeCloseTo(470 + OVERLAP - 334);
  // It keeps its top inside a window too short for it.
  expect(placeCalendar(button(16, 20), card, { width: 402, height: 300 }).top).toBe(8);
});

test("in a wider window, lines up with its button's leading edge, kept inside", () => {
  const wide = { width: 1024, height: 768 };
  expect(placeCalendar(button(400, 100), card, wide).left).toBe(400);
  expect(placeCalendar(button(900, 100), card, wide).left).toBe(1024 - 16 - 320);
  expect(placeCalendar(button(400, 100), card, wide, true).left).toBe(400 + 128 - 320);
});
