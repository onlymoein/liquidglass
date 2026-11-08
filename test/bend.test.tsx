import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { TabBar } from "../src";
import { BEND_STEPS, bendFilters } from "../src/internal/bend";

beforeEach(() => {
  // jsdom has no canvas; the maps only need somewhere to be drawn.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () =>
      ({
        createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
        putImageData: () => {},
      }) as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,");
});

afterEach(() => vi.restoreAllMocks());

test("bends a tab lens's rim a step at a time, each step a filter of its own", () => {
  const steps = bendFilters(94, 54, true);
  expect(steps).toHaveLength(BEND_STEPS);
  expect(new Set(steps).size).toBe(BEND_STEPS);
  const last = document.getElementById(steps.at(-1)!.match(/#([^"]+)/)![1]!)!;
  // Each step bends further than the one before it.
  const reach = (url: string) => Number(document.getElementById(url.match(/#([^"]+)/)![1]!)!.querySelector("feDisplacementMap")!.getAttribute("scale"));
  expect(reach(steps[0]!)).toBeLessThan(reach(steps.at(-1)!));
  // On a dark page, red, green and blue bend apart.
  expect(last.querySelectorAll("feColorMatrix")).toHaveLength(3);
  expect(bendFilters(94, 54, true)).toBe(steps);
});

test("on a light page the rim bends without parting the colours", () => {
  const last = bendFilters(80, 50, false).at(-1)!;
  expect(document.getElementById(last.match(/#([^"]+)/)![1]!)!.querySelectorAll("feColorMatrix")).toHaveLength(0);
});

test("the lens's labels sit in a layer of their own to bend, cut to the lens by a clip-path", () => {
  const { container } = render(<TabBar aria-label="Sections" items={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} defaultValue="a" />);
  const row = container.querySelector(".lg-tab-row")!;
  expect(row.parentElement!.classList.contains("lg-tab-clip")).toBe(true);
  expect(row.parentElement!.parentElement!.classList.contains("lg-tab-bend")).toBe(true);
});
