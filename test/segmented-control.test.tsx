import { fireEvent, render, screen } from "@testing-library/react";
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
