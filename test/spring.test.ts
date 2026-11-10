import { expect, test, vi } from "vitest";

import { createSpring } from "../src/internal/spring";

test("settles on the target", async () => {
  vi.useFakeTimers();
  const paint = vi.fn();
  createSpring(0, 600, 46, paint).set(1);
  await vi.runAllTimersAsync();
  expect(paint).toHaveBeenLastCalledWith(1);
  vi.useRealTimers();
});

test("doesn't wait on a frame asked for by springs that have all stopped", async () => {
  // Stopped mid-motion, as when its component unmounts.
  const gone = createSpring(0, 600, 46, () => {});
  gone.set(1);
  gone.stop();

  vi.useFakeTimers();
  const paint = vi.fn();
  createSpring(0, 600, 46, paint).set(1);
  await vi.runAllTimersAsync();
  expect(paint).toHaveBeenLastCalledWith(1);
  vi.useRealTimers();
});

test("a spring set while another paints moves in the same frame", async () => {
  vi.useFakeTimers();
  const follower = vi.fn();
  const second = createSpring(0, 600, 46, follower);
  const first = createSpring(0, 600, 46, () => second.set(1));
  first.set(1);
  await vi.runAllTimersAsync();
  expect(follower).toHaveBeenLastCalledWith(1);
  vi.useRealTimers();
});
