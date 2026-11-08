import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { PageControl } from "../src";

test("marks the current page and moves on click", () => {
  const onValueChange = vi.fn();
  render(<PageControl aria-label="Photos" count={3} defaultValue={1} onValueChange={onValueChange} />);
  expect(screen.getByRole("button", { name: "Page 2 of 3" }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(screen.getByRole("button", { name: "Page 3 of 3" }));
  expect(onValueChange).toHaveBeenCalledWith(2);
  expect(screen.getByRole("button", { name: "Page 3 of 3" }).getAttribute("aria-current")).toBe("page");
});

test("arrow keys, Home and End stay within the pages", () => {
  const onValueChange = vi.fn();
  render(<PageControl count={3} value={0} onValueChange={onValueChange} />);
  const first = screen.getByRole("button", { name: "Page 1 of 3" });
  fireEvent.keyDown(first, { key: "ArrowLeft" });
  expect(onValueChange).not.toHaveBeenCalled();
  fireEvent.keyDown(first, { key: "ArrowRight" });
  expect(onValueChange).toHaveBeenLastCalledWith(1);
  fireEvent.keyDown(first, { key: "End" });
  expect(onValueChange).toHaveBeenLastCalledWith(2);
});

test("renders without glass", () => {
  const { container } = render(<PageControl count={2} glass={false} />);
  expect(container.querySelector(".lg-glass")).toBeNull();
});

test("arrow keys move focus to the new page's dot", () => {
  render(<PageControl aria-label="Photos" count={3} defaultValue={0} />);
  fireEvent.keyDown(screen.getByRole("button", { name: "Page 1 of 3" }), { key: "ArrowRight" });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Page 2 of 3" }));
  fireEvent.keyDown(document.activeElement!, { key: "End" });
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Page 3 of 3" }));
});

test("the label is on a group that holds the dots, glass or not", () => {
  for (const glass of [true, false]) {
    const { unmount } = render(<PageControl aria-label="Photos" count={2} glass={glass} />);
    const group = screen.getByRole("group", { name: "Photos" });
    expect(group.querySelectorAll("button")).toHaveLength(2);
    unmount();
  }
});
