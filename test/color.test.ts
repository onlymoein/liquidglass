import { expect, test } from "vitest";

import {
  cssColor,
  formatColor,
  GRID_COLUMNS,
  GRID_ROWS,
  gridColors,
  hsvToRgb,
  parseColor,
  rgbToHsv,
  spectrumAt,
  spectrumOf,
} from "../src/internal/color";

test("reads the four hex forms, in either case", () => {
  expect(parseColor("#0af")).toEqual({ r: 0, g: 170, b: 255, a: 1 });
  expect(parseColor("#0AF8")).toEqual({ r: 0, g: 170, b: 255, a: 0.53 });
  expect(parseColor("#00aaff")).toEqual({ r: 0, g: 170, b: 255, a: 1 });
  expect(parseColor("#00AAFF80")).toEqual({ r: 0, g: 170, b: 255, a: 0.5 });
  expect(parseColor("  #fff  ")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
});

test("refuses everything that isn't exactly a hex colour", () => {
  for (const bad of [
    "",
    "red",
    "fff",
    "#12",
    "#12345",
    "#1234567",
    "#ggg",
    "rgb(0 0 0)",
    "#fff;background:red",
    "#fff) , url(javascript:alert(1)",
    "#fff\n#000",
    "url(x)",
    "expression(1)",
    "#fff0000000",
  ])
    expect(parseColor(bad), bad).toBeNull();
  for (const bad of [null, undefined, 12, {}, ["#fff"]]) expect(parseColor(bad)).toBeNull();
});

test("writes hex, with opacity only when there is some to write", () => {
  expect(formatColor({ r: 0, g: 136, b: 255, a: 1 })).toBe("#0088ff");
  expect(formatColor({ r: 0, g: 136, b: 255, a: 0.5 })).toBe("#0088ff80");
  expect(formatColor({ r: 0, g: 136, b: 255, a: 0.5 }, false)).toBe("#0088ff");
  expect(formatColor({ r: -5, g: 300, b: 12.4, a: 1 })).toBe("#00ff0c");
});

test("builds style values from numbers alone", () => {
  expect(cssColor({ r: 0, g: 136, b: 255, a: 0.5 })).toBe("rgb(0 136 255 / 0.5)");
  expect(cssColor({ r: 999, g: -1, b: 3.6, a: 7 })).toBe("rgb(255 0 4 / 1)");
});

test("goes between rgb and hsv without losing a step", () => {
  for (let r = 0; r < 256; r += 15)
    for (let g = 0; g < 256; g += 15)
      for (let b = 0; b < 256; b += 15) {
        const color = { r, g, b, a: 1 };
        expect(hsvToRgb(rgbToHsv(color)), `${r} ${g} ${b}`).toEqual(color);
      }
  expect(rgbToHsv({ r: 255, g: 0, b: 0, a: 1 })).toEqual({ h: 0, s: 1, v: 1, a: 1 });
  expect(rgbToHsv({ r: 0, g: 0, b: 255, a: 1 }).h).toBe(240);
  expect(rgbToHsv({ r: 128, g: 128, b: 128, a: 1 }).s).toBe(0);
});

test("the spectrum runs white, the full colour, then black down it, and round the hues across", () => {
  expect(spectrumAt(0.5, 0)).toEqual({ h: 180, s: 0, v: 1 });
  expect(spectrumAt(0.5, 0.5)).toEqual({ h: 180, s: 1, v: 1 });
  expect(spectrumAt(0.5, 1)).toEqual({ h: 180, s: 1, v: 0 });
  expect(spectrumAt(-3, 9)).toEqual({ h: 0, s: 1, v: 0 });
  expect(spectrumAt(3, -9)).toEqual({ h: 360, s: 0, v: 1 });
});

test("finds a colour on the spectrum where it was picked", () => {
  for (const [x, y] of [[0.25, 0.1], [0.5, 0.5], [0.75, 0.9], [0, 0], [1, 1]] as const) {
    const { h, s, v } = spectrumAt(x, y);
    const found = spectrumOf({ h, s, v, a: 1 });
    expect(found.x).toBeCloseTo(x, 6);
    expect(found.y).toBeCloseTo(y, 6);
  }
});

test("the grid is greys, then rows of hues, and every cell is a hex colour", () => {
  const grid = gridColors();
  expect(grid).toHaveLength(GRID_COLUMNS * GRID_ROWS);
  expect(grid[0]).toBe("#ffffff");
  expect(grid[GRID_COLUMNS - 1]).toBe("#000000");
  for (const color of grid) expect(parseColor(color), color).not.toBeNull();
  // The first hue column of each row after the greys is red-ish and never grey.
  const reds = grid.filter((_, index) => index >= GRID_COLUMNS && index % GRID_COLUMNS === 0).map((hex) => parseColor(hex)!);
  for (const { r, g, b } of reds) expect(r).toBeGreaterThan(Math.max(g, b) - 1);
});
