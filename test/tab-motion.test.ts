import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createSpring } from "../src/internal/spring";
import { DRAG, REST } from "../src/internal/tab-motion";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// Runs a spring from 0 to 1 and returns what it painted, with when.
async function run([stiffness, damping]: readonly [number, number, ...number[]]) {
  const frames: { at: number; value: number }[] = [];
  const start = performance.now();
  createSpring(0, stiffness, damping, (value) => frames.push({ at: performance.now() - start, value })).set(1);
  await vi.runAllTimersAsync();
  return frames;
}

test("the lens swings a little past its tab and settles back", async () => {
  const frames = await run(REST);
  const peak = Math.max(...frames.map((frame) => frame.value));
  expect(peak).toBeGreaterThan(1.03);
  expect(peak).toBeLessThan(1.08);
  expect(frames.at(-1)!.value).toBe(1);
});

test("it covers the way in about 170 ms, and is still for good after about 430", async () => {
  const frames = await run(REST);
  const mostly = frames.find((frame) => frame.value >= 0.9)!.at;
  const still = [...frames].reverse().find((frame) => Math.abs(frame.value - 1) > 0.01)!.at;
  // The critical spring it replaced was nine tenths of the way in 110 ms and still in 173.
  expect(mostly).toBeGreaterThan(150);
  expect(mostly).toBeLessThan(200);
  expect(still).toBeGreaterThan(350);
  expect(still).toBeLessThan(500);
});

test("under a finger the lens follows without swinging", async () => {
  const frames = await run(DRAG);
  expect(Math.max(...frames.map((frame) => frame.value))).toBeLessThan(1.005);
});
