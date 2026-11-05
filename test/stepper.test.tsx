import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Stepper } from "../src";

test("steps down and up within its limits", () => {
  const onValueChange = vi.fn();
  render(<Stepper aria-label="Count" defaultValue={1} min={0} max={2} onValueChange={onValueChange} />);
  const down = screen.getByRole("button", { name: "Decrease" }) as HTMLButtonElement;
  const up = screen.getByRole("button", { name: "Increase" }) as HTMLButtonElement;
  fireEvent.click(up);
  expect(onValueChange).toHaveBeenLastCalledWith(2);
  expect(up.disabled).toBe(true);
  fireEvent.click(down);
  fireEvent.click(down);
  expect(onValueChange).toHaveBeenLastCalledWith(0);
  expect(down.disabled).toBe(true);
});

test("uses its step", () => {
  const onValueChange = vi.fn();
  render(<Stepper aria-label="Count" defaultValue={10} step={5} onValueChange={onValueChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Increase" }));
  expect(onValueChange).toHaveBeenCalledWith(15);
});
