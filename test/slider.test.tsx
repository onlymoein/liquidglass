import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Slider } from "../src";

test("reports changes from the native range input", () => {
  const onValueChange = vi.fn();
  render(<Slider aria-label="Volume" defaultValue={20} onValueChange={onValueChange} />);
  const input = screen.getByRole("slider", { name: "Volume" }) as HTMLInputElement;
  expect(input.value).toBe("20");

  fireEvent.change(input, { target: { value: "75" } });
  expect(onValueChange).toHaveBeenLastCalledWith(75);
  expect(input.value).toBe("75");
});

test("exposes progress for the thumb and fill", () => {
  const { container } = render(<Slider aria-label="Volume" value={30} min={20} max={70} />);
  const root = container.firstElementChild as HTMLElement;
  expect(root.style.getPropertyValue("--lg-progress")).toBe("0.2");
});

test("passes range attributes through", () => {
  render(<Slider aria-label="Volume" min={0} max={10} step={2} disabled />);
  const input = screen.getByRole("slider") as HTMLInputElement;
  expect([input.min, input.max, input.step, input.disabled]).toEqual(["0", "10", "2", true]);
});

test("keeps a touch on the thumb from scrolling the page", () => {
  render(<Slider aria-label="Volume" />);
  const css = document.querySelector('style[data-liquidglass="slider"]')!.textContent!;
  expect(css).toMatch(/\.lg-slider input::-webkit-slider-thumb\s*\{[^}]*touch-action:\s*none/);
});

function fingerSlider() {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
  const onValueChange = vi.fn();
  render(<Slider aria-label="Value" defaultValue={50} onValueChange={onValueChange} />);
  const root = screen.getByRole("slider").parentElement!;
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ left: 0, width: 337, right: 337, top: 0, bottom: 40, height: 40 } as DOMRect);
  return { root, onValueChange };
}

test("a finger on the track doesn't move the thumb, as on iOS", () => {
  const { root, onValueChange } = fingerSlider();
  fireEvent.pointerDown(root, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: 320 });
  fireEvent.pointerMove(root, { pointerId: 1, pointerType: "touch", clientX: 300 });
  fireEvent.pointerUp(root, { pointerId: 1, pointerType: "touch", clientX: 300 });
  expect(onValueChange).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

test("a finger on the thumb moves it by as much as the finger moves, wherever it took hold", () => {
  const { root, onValueChange } = fingerSlider();
  fireEvent.pointerDown(root, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: 180 });
  fireEvent.pointerMove(root, { pointerId: 1, pointerType: "touch", clientX: 210 });
  expect(onValueChange).toHaveBeenLastCalledWith(60);
  fireEvent.pointerUp(root, { pointerId: 1, pointerType: "touch", clientX: 210 });
  vi.restoreAllMocks();
});
