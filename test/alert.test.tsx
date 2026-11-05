import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Alert } from "../src";

const dialog = () => document.querySelector("dialog")!;

test("shows nothing until it's open", () => {
  render(<Alert title="Delete?" actions={[{ label: "Cancel", role: "cancel" }]} />);
  expect(screen.queryByText("Delete?")).toBeNull();
  expect(dialog().hasAttribute("open")).toBe(false);
});

test("runs the chosen action, then closes after animating out", () => {
  vi.useFakeTimers();
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <Alert
      defaultOpen
      onOpenChange={onOpenChange}
      title="Delete?"
      message="It can't be undone."
      actions={[{ label: "Cancel", role: "cancel" }, { label: "Delete", role: "destructive", onSelect }]}
    />,
  );
  expect(screen.getByText("It can't be undone.")).toBeTruthy();
  fireEvent.click(screen.getByText("Delete"));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(dialog().dataset.phase).toBe("leaving");
  act(() => {
    vi.advanceTimersByTime(200);
  });
  expect(dialog().dataset.phase).toBe("closed");
  vi.useRealTimers();
});

test("Escape runs the cancel action", () => {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  render(<Alert open onOpenChange={onOpenChange} title="Delete?" actions={[{ label: "Cancel", role: "cancel", onSelect }]} />);
  fireEvent(dialog(), new Event("cancel", { cancelable: true }));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("marks a destructive action and stacks more than two", () => {
  render(<Alert open title="Delete?" actions={[{ label: "A" }, { label: "B", role: "destructive" }, { label: "C" }]} />);
  expect(screen.getByText("B").hasAttribute("data-destructive")).toBe(true);
  expect(document.querySelector(".lg-alert-actions")?.hasAttribute("data-stacked")).toBe(true);
});
