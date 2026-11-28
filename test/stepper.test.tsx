import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Stepper } from "../src";
import { rule } from "./rule";

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

test("is iOS 27's size: two 47-point halves, a 24-point divider and 13-point glyphs", () => {
  render(<Stepper aria-label="Count" />);
  expect(rule("stepper", ".lg-stepper-button")).toContain("width: 47px");
  const divider = rule("stepper", ".lg-stepper-divider");
  expect(divider).toContain("height: 24px");
  expect(divider).toContain("background: var(--lg-stepper-divider)");
  const plus = screen.getByRole("button", { name: "Increase" }).querySelector("svg")!;
  expect(plus.getAttribute("stroke-width")).toBe("1.67");
  expect(plus.querySelector("path")!.getAttribute("d")).toBe("M2.33 8h11.33M8 2.33v11.33");
  const light = rule("base", ':where(:root, [data-theme="light"])');
  expect(light).toContain("--lg-stepper: rgb(118 118 128 / 0.125)");
  expect(light).toContain("--lg-stepper-divider: rgb(60 60 67 / 0.3)");
  expect(rule("base", ':where([data-theme="dark"])')).toContain("--lg-stepper-divider: rgb(235 235 245 / 0.3)");
});
