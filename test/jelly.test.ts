import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { createJelly, FLAT, squash, type Squash } from "../src/internal/jelly";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("a lens that isn't trailing keeps its shape", () => {
  expect(squash(0, 60)).toBe(FLAT);
  expect(squash(10, 0)).toBe(FLAT);
  expect(squash(1e-6, 60)).toBe(FLAT);
});

test("stretches along the drag and thins across it, by more the further it trails", () => {
  const near = squash(10, 60);
  const far = squash(60, 60);
  expect(near.x).toBeGreaterThan(1);
  expect(near.y).toBeLessThan(1);
  expect(far.x).toBeGreaterThan(near.x);
  expect(far.y).toBeLessThan(near.y);
});

test("stretches the same either way, and stops short of tearing", () => {
  expect(squash(-40, 60).x).toBeCloseTo(squash(40, 60).x);
  expect(squash(1e6, 60).x).toBeLessThanOrEqual(1.3 + 1e-9);
  expect(squash(1e6, 60).y).toBeGreaterThan(0.8);
});

test("the body trails behind the place it was taken to, as far as it shows", () => {
  expect(squash(40, 60, 0).shift).toBeCloseTo(0);
  expect(squash(40, 60, 0.35).shift).toBeCloseTo(-14);
  expect(squash(-40, 60, 0.35).shift).toBeCloseTo(14);
});

test("a quick drag pulls the lens out, and it swings back to its own shape", async () => {
  const shapes: Squash[] = [];
  const jelly = createJelly(() => 60, (shape) => shapes.push(shape));
  jelly.follow(0, true);
  jelly.follow(300);
  await vi.advanceTimersByTimeAsync(80);
  expect(Math.max(...shapes.map((shape) => shape.x))).toBeGreaterThan(1.1);
  // It overshoots once, so the stretch reverses before it comes to rest.
  await vi.runAllTimersAsync();
  expect(shapes.some((shape) => shape.shift > 0 || shape.x > 1)).toBe(true);
  expect(shapes.at(-1)).toBe(FLAT);
});

test("a slow drag leaves it as it was", async () => {
  const shapes: Squash[] = [];
  const jelly = createJelly(() => 60, (shape) => shapes.push(shape));
  jelly.follow(0, true);
  for (let place = 1; place <= 40; place++) {
    jelly.follow(place * 0.5);
    await vi.advanceTimersByTimeAsync(16);
  }
  expect(Math.max(...shapes.map((shape) => shape.x), 1)).toBeLessThan(1.02);
});

test("put in place, nothing trails it", async () => {
  const paint = vi.fn();
  const jelly = createJelly(() => 60, paint);
  jelly.follow(0, true);
  jelly.follow(500, true);
  await vi.runAllTimersAsync();
  expect(paint).not.toHaveBeenCalled();
});

test("starts from where it's first put, not from nothing", async () => {
  const paint = vi.fn();
  const jelly = createJelly(() => 60, paint);
  // A lens first shown a long way from the start of its track isn't flung there.
  jelly.follow(800);
  await vi.runAllTimersAsync();
  expect(paint).not.toHaveBeenCalled();
});

test("stops when its component goes", async () => {
  const paint = vi.fn();
  const jelly = createJelly(() => 60, paint);
  jelly.follow(0, true);
  jelly.follow(300);
  jelly.stop();
  await vi.runAllTimersAsync();
  expect(paint).not.toHaveBeenCalled();
});
