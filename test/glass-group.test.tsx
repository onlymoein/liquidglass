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

test("the shared glass takes its shape from a mask in the page, and the rim draws the same outline", () => {
  const { container } = render(
    <GlassGroup>
      <Glass>One</Glass>
    </GlassGroup>,
  );
  const shape = container.querySelector<HTMLElement>(".lg-glass-group-shape")!;
  const id = /url\(["']?#([^"')]+)/.exec(shape.style.getPropertyValue("mask"))?.[1];
  const path = container.querySelector(`mask[id="${id}"] path`);
  expect(path).not.toBeNull();
  expect(path!.getAttribute("d")).toBe(container.querySelector(".lg-glass-group-hairline")!.getAttribute("d"));
});
