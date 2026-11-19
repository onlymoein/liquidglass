import { expect, test } from "vitest";

import { painter, type PaintImage } from "../src/internal/paint";

const paint = painter();

/** Shrinks an image by `factor` each way, averaging premultiplied, as a screen would show it smaller. */
function shrink(source: PaintImage, factor: number): PaintImage {
  const width = Math.floor(source.width / factor);
  const height = Math.floor(source.height / factor);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let alpha = 0;
      let white = 0;
      for (let j = 0; j < factor; j++) {
        for (let k = 0; k < factor; k++) {
          const i = ((y * factor + j) * source.width + x * factor + k) * 4;
          alpha += source.data[i + 3]!;
          white += source.data[i]! * source.data[i + 3]!;
        }
      }
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = alpha ? white / alpha : 0;
      data[i + 3] = alpha / (factor * factor);
    }
  }
  return { width, height, data };
}

function largestDifference(a: PaintImage, b: PaintImage): number {
  let largest = 0;
  for (let i = 0; i < a.width * a.height * 4; i += 4) {
    largest = Math.max(largest, Math.abs(a.data[i + 3]! - b.data[i + 3]!));
    // Colour only counts where there's something to see.
    if (a.data[i + 3]! > 8) largest = Math.max(largest, Math.abs(a.data[i]! - b.data[i]!) * (a.data[i + 3]! / 255));
  }
  return largest;
}

test("a rim drawn for an ordinary screen is the sharp one, made smaller", () => {
  for (const [width, height, radius] of [
    [120, 44, 22],
    [300, 90, 26],
  ] as const) {
    const fine = paint.rim(width, height, radius, 1, 0, 4).images[0]!;
    const plain = paint.rim(width, height, radius, 1, 0, 1).images[0]!;
    expect(plain.width).toBe(fine.width / 4);
    expect(largestDifference(plain, shrink(fine, 4))).toBeLessThanOrEqual(2);
  }
});

test("a held lens's rim is smooth on an ordinary screen too", () => {
  const fine = paint.rim(64, 28, 14, 1, 0, 4, true).images[0]!;
  const plain = paint.rim(64, 28, 14, 1, 0, 1, true).images[0]!;
  expect(largestDifference(plain, shrink(fine, 4))).toBeLessThanOrEqual(2);
});

test("a pixel the edge passes through bends, so a curve shows no steps", () => {
  // A capsule's end crosses the pixel at (5, 5) about a seventh of the way in, though its centre is outside.
  const [field] = paint.displacement(100, 40, 20, false, undefined, undefined, 1, 1).images;
  const i = (5 * 100 + 5) * 4;
  expect(field!.data[i]).not.toBe(128);
  expect(field!.data[i + 1]).not.toBe(128);
});
