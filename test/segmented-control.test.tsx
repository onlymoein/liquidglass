import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { SegmentedControl } from "../src";

const items = [
  { value: "boxes", label: "Boxes" },
  { value: "pallets", label: "Pallets" },
  { value: "skids", label: "Skids", disabled: true },
];

test("starts on the first choice and chooses another when clicked", () => {
  const onValueChange = vi.fn();
  render(<SegmentedControl aria-label="Kind" items={items} onValueChange={onValueChange} />);
  expect(screen.getByRole("radio", { name: "Boxes" }).getAttribute("aria-checked")).toBe("true");
  fireEvent.click(screen.getByRole("radio", { name: "Pallets" }));
  expect(onValueChange).toHaveBeenCalledWith("pallets");
  expect(screen.getByRole("radio", { name: "Pallets" }).getAttribute("aria-checked")).toBe("true");
});

test("moves with the arrow keys, skipping a disabled choice", () => {
  render(<SegmentedControl aria-label="Kind" items={items} defaultValue="pallets" />);
  const group = screen.getByRole("radiogroup", { name: "Kind" });
  fireEvent.keyDown(group, { key: "ArrowRight" });
  expect(screen.getByRole("radio", { name: "Boxes" }).getAttribute("aria-checked")).toBe("true");
  expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Boxes" }));
});

test("follows a controlled value", () => {
  const { rerender } = render(<SegmentedControl aria-label="Kind" items={items} value="boxes" />);
  fireEvent.click(screen.getByRole("radio", { name: "Pallets" }));
  expect(screen.getByRole("radio", { name: "Boxes" }).getAttribute("aria-checked")).toBe("true");
  rerender(<SegmentedControl aria-label="Kind" items={items} value="pallets" />);
  expect(screen.getByRole("radio", { name: "Pallets" }).getAttribute("aria-checked")).toBe("true");
});

function press(target: Element, type: string, clientX: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button: 0 });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
  act(() => {
    target.dispatchEvent(event);
  });
}

function wide(group: Element) {
  // Three segments of 100.
  group.getBoundingClientRect = () => ({ width: 300 }) as DOMRect;
}

test("dragging the thumb chooses where it's let go, and the click after it changes nothing", () => {
  const onValueChange = vi.fn();
  const open = items.map((item) => ({ ...item, disabled: false }));
  render(<SegmentedControl aria-label="Kind" items={open} onValueChange={onValueChange} />);
  const group = screen.getByRole("radiogroup", { name: "Kind" });
  wide(group);
  const boxes = screen.getByRole("radio", { name: "Boxes" });
  press(boxes, "pointerdown", 50);
  press(group, "pointermove", 180);
  press(group, "pointermove", 240);
  press(window as unknown as Element, "pointerup", 240);
  expect(onValueChange).toHaveBeenCalledTimes(1);
  expect(onValueChange).toHaveBeenCalledWith("skids");
  fireEvent.click(boxes);
  expect(onValueChange).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("radio", { name: "Skids" }).getAttribute("aria-checked")).toBe("true");
});

test("a drag can't land on a disabled choice", () => {
  const onValueChange = vi.fn();
  render(<SegmentedControl aria-label="Kind" items={items} onValueChange={onValueChange} />);
  const group = screen.getByRole("radiogroup", { name: "Kind" });
  wide(group);
  press(screen.getByRole("radio", { name: "Boxes" }), "pointerdown", 50);
  press(group, "pointermove", 260);
  press(window as unknown as Element, "pointerup", 260);
  expect(onValueChange).toHaveBeenCalledWith("pallets");
});

test("a drag only starts from the thumb, and a cancelled one chooses nothing", () => {
  const onValueChange = vi.fn();
  const open = items.map((item) => ({ ...item, disabled: false }));
  render(<SegmentedControl aria-label="Kind" items={open} onValueChange={onValueChange} />);
  const group = screen.getByRole("radiogroup", { name: "Kind" });
  wide(group);
  press(screen.getByRole("radio", { name: "Pallets" }), "pointerdown", 150);
  press(group, "pointermove", 280);
  press(window as unknown as Element, "pointerup", 280);
  expect(onValueChange).not.toHaveBeenCalled();
  press(screen.getByRole("radio", { name: "Boxes" }), "pointerdown", 50);
  press(group, "pointermove", 280);
  press(window as unknown as Element, "pointercancel", 280);
  expect(onValueChange).not.toHaveBeenCalled();
});
