import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { Button, SegmentedControl, Slider, Switch } from "../src";

let drawn = 0;

beforeEach(() => {
  vi.useFakeTimers();
  drawn = 0;
  // jsdom has no canvas; the rim only needs somewhere to be drawn, and each drawing to tell apart.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
        putImageData: () => {},
      }) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(() => `data:image/png;base64,${++drawn}`);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("lg-slider-thumb") ? 37 : this.classList.contains("lg-slider") ? 337 : 120;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(44);
  // Fingers on a screen, with motion allowed.
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) => ({ matches: query.includes("coarse"), media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// The sizes arrive as the browser reports them, once the page is idle.
function reportSizes() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: () => void) {}
      observe() {
        this.callback();
      }
      unobserve() {}
      disconnect() {}
    },
  );
}

afterEach(() => vi.unstubAllGlobals());

test.each([
  ["slider", () => render(<Slider aria-label="Value" />).container.querySelector(".lg-slider-thumb")!],
  ["switch", () => render(<Switch aria-label="Wi-Fi" />).container.querySelector(".lg-switch-thumb")!],
  ["segmented control", () => render(<SegmentedControl aria-label="Size" items={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} />).container.querySelector(".lg-segmented-lens")!],
])("the %s's lens has the lit edge the tab bar's does", async (_name, show) => {
  reportSizes();
  const lens = show() as HTMLElement;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(lens.style.getPropertyValue("--lg-rim")).toMatch(/^url\(/);
});

test("a thumb taken quickly along the track stretches along it, then settles", async () => {
  const { container } = render(<Slider aria-label="Value" defaultValue={10} />);
  const root = container.firstElementChild as HTMLElement;
  const thumb = container.querySelector<HTMLElement>(".lg-slider-thumb")!;
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ left: 0, width: 337, right: 337, top: 0, bottom: 40, height: 40 } as DOMRect);
  const input = screen.getByRole("slider") as HTMLInputElement;
  const at = 18.5 + (300 * 10) / 100;

  fireEvent.pointerDown(root, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: at });
  expect(thumb.style.transform).toBe("");
  // Flung most of the way across within a few frames.
  for (let x = at; x <= at + 220; x += 55) {
    fireEvent.pointerMove(root, { pointerId: 1, pointerType: "touch", clientX: x });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });
  }
  const scale = /scale\(([\d.]+), ([\d.]+)\)/.exec(thumb.style.transform);
  expect(scale).not.toBeNull();
  expect(Number(scale![1])).toBeGreaterThan(1.1);
  expect(Number(scale![2])).toBeLessThan(0.95);
  expect(Number(input.value)).toBeGreaterThan(60);

  // And once it stops, it swings back to its own shape.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(thumb.style.transform).toBe("");
});

test("a thumb taken slowly keeps its shape", async () => {
  const { container } = render(<Slider aria-label="Value" defaultValue={10} />);
  const root = container.firstElementChild as HTMLElement;
  const thumb = container.querySelector<HTMLElement>(".lg-slider-thumb")!;
  vi.spyOn(root, "getBoundingClientRect").mockReturnValue({ left: 0, width: 337, right: 337, top: 0, bottom: 40, height: 40 } as DOMRect);
  const at = 18.5 + (300 * 10) / 100;

  fireEvent.pointerDown(root, { pointerId: 1, pointerType: "touch", isPrimary: true, clientX: at });
  for (let x = at; x <= at + 40; x += 1) {
    fireEvent.pointerMove(root, { pointerId: 1, pointerType: "touch", clientX: x });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16);
    });
    const scale = /scale\(([\d.]+), /.exec(thumb.style.transform);
    expect(scale ? Number(scale[1]) : 1).toBeLessThan(1.03);
  }
});

test("glass lights its edge while it's pressed, and puts it back after", async () => {
  reportSizes();
  render(<Button>Large</Button>);
  const button = screen.getByRole("button");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  const resting = button.style.getPropertyValue("--lg-rim-image");
  expect(resting).toMatch(/^url\(/);

  fireEvent.pointerDown(button, { pointerId: 1, pointerType: "touch", isPrimary: true, button: 0, clientX: 5, clientY: 5 });
  const held = button.style.getPropertyValue("--lg-rim-image");
  expect(button.hasAttribute("data-pressed")).toBe(true);
  expect(held).not.toBe(resting);

  fireEvent.pointerUp(window, { pointerId: 1, pointerType: "touch" });
  expect(button.hasAttribute("data-pressed")).toBe(false);
  expect(button.style.getPropertyValue("--lg-rim-image")).toBe(resting);
});
