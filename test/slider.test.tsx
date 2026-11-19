import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Slider } from "../src";
import { tickValues } from "../src/slider";

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

test("draws no ticks unless asked for them", () => {
  const { container } = render(<Slider aria-label="Volume" step={10} />);
  expect(container.querySelectorAll(".lg-slider-tick")).toHaveLength(0);
});

test("`ticks` marks every step, from the minimum to the maximum", () => {
  expect(tickValues(true, 0, 10, 2)).toEqual([0, 2, 4, 6, 8, 10]);
  expect(tickValues(true, 1, 2, 0.25)).toEqual([1, 1.25, 1.5, 1.75, 2]);
  const { container } = render(<Slider aria-label="Volume" min={0} max={10} step={5} ticks />);
  const marks = [...container.querySelectorAll<HTMLElement>(".lg-slider-tick")];
  expect(marks.map((mark) => mark.style.getPropertyValue("--lg-at"))).toEqual(["0", "0.5", "1"]);
});

test("steps too many to tell apart get no ticks", () => {
  expect(tickValues(true, 0, 100, 1)).toEqual([]);
  expect(tickValues(true, 0, 50, 1)).toHaveLength(51);
  expect(tickValues(true, 0, 10, 0)).toEqual([]);
  expect(tickValues(true, 5, 5, 1)).toEqual([]);
});

test("a list of ticks marks those values, once each, in order, and only those on the track", () => {
  expect(tickValues([50, 0, 50, 120, -1, Number.NaN, 25], 0, 100, 1)).toEqual([0, 25, 50]);
  expect(tickValues([], 0, 100, 1)).toEqual([]);
  expect(tickValues(false, 0, 100, 1)).toEqual([]);
});

test("ticks the thumb has passed are drawn over the fill", () => {
  const { container } = render(<Slider aria-label="Volume" value={50} min={0} max={100} step={25} ticks />);
  const passed = [...container.querySelectorAll(".lg-slider-tick")].map((mark) => mark.hasAttribute("data-passed"));
  expect(passed).toEqual([true, true, true, false, false]);
  const css = document.querySelector('style[data-liquidglass="slider"]')!.textContent!;
  expect(css).toMatch(/\.lg-slider-tick\[data-passed\]\s*\{[^}]*background:\s*rgb\(255 255 255/);
});

test("ticks are decoration: the range input is still the one control", () => {
  const { container } = render(<Slider aria-label="Volume" step={25} ticks />);
  expect(container.querySelector(".lg-slider-track")!.getAttribute("aria-hidden")).toBe("true");
  expect(screen.getAllByRole("slider")).toHaveLength(1);
});

test("end icons sit either side of the track, hidden from screen readers", () => {
  const { container } = render(
    <Slider aria-label="Volume" minimumIcon={<i data-testid="quiet" />} maximumIcon={<i data-testid="loud" />} />,
  );
  const [first, body, last] = [...container.firstElementChild!.children];
  expect(first!.className).toBe("lg-slider-icon");
  expect(first!.getAttribute("aria-hidden")).toBe("true");
  expect(first!.contains(screen.getByTestId("quiet"))).toBe(true);
  expect(body!.className).toBe("lg-slider-body");
  expect(body!.contains(screen.getByRole("slider"))).toBe(true);
  expect(last!.className).toBe("lg-slider-icon");
  expect(last!.contains(screen.getByTestId("loud"))).toBe(true);
  expect(screen.getByRole("slider", { name: "Volume" })).toBeTruthy();
});

test("without end icons there are none", () => {
  const { container } = render(<Slider aria-label="Volume" />);
  expect(container.querySelectorAll(".lg-slider-icon")).toHaveLength(0);
  expect(container.firstElementChild!.children).toHaveLength(1);
});

test("a finger takes the thumb by the track's own box, icons or none", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList);
  const onValueChange = vi.fn();
  render(<Slider aria-label="Value" defaultValue={50} minimumIcon={<i />} maximumIcon={<i />} onValueChange={onValueChange} />);
  const body = screen.getByRole("slider").parentElement!;
  expect(body.className).toBe("lg-slider-body");
  vi.spyOn(body, "getBoundingClientRect").mockReturnValue({ left: 0, width: 337, right: 337, top: 0, bottom: 40, height: 40 } as DOMRect);
  fireEvent.pointerDown(body, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: 180 });
  fireEvent.pointerMove(body, { pointerId: 1, pointerType: "touch", clientX: 210 });
  expect(onValueChange).toHaveBeenLastCalledWith(60);
  fireEvent.pointerUp(body, { pointerId: 1, pointerType: "touch", clientX: 210 });
  vi.restoreAllMocks();
});
