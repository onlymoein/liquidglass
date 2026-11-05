import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Sheet } from "../src";

test("shows its content only while open", () => {
  const { rerender } = render(<Sheet aria-label="Details">Body</Sheet>);
  expect(screen.queryByText("Body")).toBeNull();
  rerender(<Sheet aria-label="Details" open>Body</Sheet>);
  expect(screen.getByText("Body")).toBeTruthy();
  expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(true);
});

test("asks to close when the scrim is tapped or Escape is pressed", () => {
  const onOpenChange = vi.fn();
  render(<Sheet aria-label="Details" open onOpenChange={onOpenChange}>Body</Sheet>);
  fireEvent.click(document.querySelector(".lg-modal-scrim")!);
  expect(onOpenChange).toHaveBeenCalledWith(false);
  onOpenChange.mockClear();
  fireEvent(document.querySelector("dialog")!, new Event("cancel", { cancelable: true }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});
