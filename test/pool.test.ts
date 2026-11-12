import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { pool } from "../src/internal/painting";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("keeps what's held, and only the last few of what isn't", () => {
  const forgotten: string[] = [];
  const kept = pool(2, (key) => forgotten.push(key));
  kept.hold("in-use");
  for (const key of ["a", "b", "c", "d"]) {
    kept.hold(key);
    kept.drop(key);
  }
  expect(forgotten).toEqual(["a", "b"]);
  kept.drop("in-use");
  expect(forgotten).toEqual(["a", "b", "c"]);
});

test("counts each user, letting go only once the last one stops", () => {
  const forgotten: string[] = [];
  const kept = pool(0, (key) => forgotten.push(key));
  kept.hold("shared");
  kept.hold("shared");
  kept.drop("shared");
  expect(forgotten).toEqual([]);
  kept.drop("shared");
  expect(forgotten).toEqual(["shared"]);
});

test("gives what was just made time to be taken up before counting it unused", () => {
  const forgotten: string[] = [];
  const kept = pool(0, (key) => forgotten.push(key));
  kept.made("taken");
  kept.made("left");
  kept.hold("taken");
  vi.advanceTimersByTime(1000);
  expect(forgotten).toEqual([]);
  vi.advanceTimersByTime(1500);
  expect(forgotten).toEqual(["left"]);
});

test("takes back what's held again before it's let go", () => {
  const forgotten: string[] = [];
  const kept = pool(1, (key) => forgotten.push(key));
  kept.hold("a");
  kept.drop("a");
  kept.hold("a");
  kept.hold("b");
  kept.drop("b");
  kept.hold("c");
  kept.drop("c");
  expect(forgotten).toEqual(["b"]);
});
