import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { Glass, GlassGroup } from "../src";
import { outline } from "../src/internal/contour";

const square = (x: number) => ({ x, y: 10, width: 40, height: 40, radius: 20 });
const pieces = (path: string) => path.split("Z").filter(Boolean).length;

test("two circles far apart stay two outlines", () => {
  expect(pieces(outline([square(10), square(100)], 20, 160, 60))).toBe(2);
});

test("two circles within the spacing flow into one outline", () => {
  expect(pieces(outline([square(10), square(55)], 20, 120, 60))).toBe(1);
});

test("nothing to draw gives no outline", () => {
  expect(outline([], 20, 100, 100)).toBe("");
});

test("keeps its children and adds the shared glass behind them", () => {
  const { container } = render(
    <GlassGroup aria-label="Tools">
      <Glass>One</Glass>
    </GlassGroup>,
  );
  const group = container.querySelector(".lg-glass-group")!;
  expect(group.querySelector(".lg-glass-group-shape")).not.toBeNull();
  expect(group.textContent).toBe("One");
});
