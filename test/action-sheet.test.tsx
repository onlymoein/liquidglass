import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { ActionSheet } from "../src";

const dialog = () => document.querySelector("dialog")!;
const scrim = () => document.querySelector<HTMLElement>(".lg-modal-scrim")!;
const rows = () => [...document.querySelectorAll<HTMLButtonElement>(".lg-action-sheet-action")];

test("shows nothing until it's open", () => {
  render(<ActionSheet title="Delete?" actions={[{ label: "Cancel", role: "cancel" }]} />);
  expect(screen.queryByText("Delete?")).toBeNull();
  expect(dialog().hasAttribute("open")).toBe(false);
});

test("runs the chosen action, then closes after animating out", () => {
  vi.useFakeTimers();
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ActionSheet
      defaultOpen
      onOpenChange={onOpenChange}
      title="Delete?"
      message="It can't be undone."
      actions={[{ label: "Delete", role: "destructive", onSelect }, { label: "Cancel", role: "cancel" }]}
    />,
  );
  expect(screen.getByText("It can't be undone.")).toBeTruthy();
  fireEvent.click(screen.getByText("Delete", { selector: "button" }));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(dialog().dataset.phase).toBe("leaving");
  act(() => {
    vi.advanceTimersByTime(400);
  });
  expect(dialog().dataset.phase).toBe("closed");
  vi.useRealTimers();
});

test("puts the cancel action in a card of its own, last, whatever its place in the list", () => {
  render(<ActionSheet open title="Share" actions={[{ label: "Cancel", role: "cancel" }, { label: "Copy" }, { label: "Mail" }]} />);
  const cards = document.querySelectorAll(".lg-action-sheet-card");
  expect(cards).toHaveLength(2);
  expect([...cards[0]!.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Copy", "Mail"]);
  expect([...cards[1]!.querySelectorAll("button")].map((button) => button.textContent)).toEqual(["Cancel"]);
  expect(cards[1]!.querySelector("button")!.hasAttribute("data-cancel")).toBe(true);
});

test("has one card when there's no cancel action", () => {
  render(<ActionSheet open title="Share" actions={[{ label: "Copy" }]} />);
  expect(document.querySelectorAll(".lg-action-sheet-card")).toHaveLength(1);
});

test("Escape runs the cancel action", () => {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  render(<ActionSheet open onOpenChange={onOpenChange} title="Share" actions={[{ label: "Copy" }, { label: "Cancel", role: "cancel", onSelect }]} />);
  fireEvent(dialog(), new Event("cancel", { cancelable: true }));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("a tap outside runs the cancel action once", () => {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  render(<ActionSheet defaultOpen onOpenChange={onOpenChange} title="Share" actions={[{ label: "Copy" }, { label: "Cancel", role: "cancel", onSelect }]} />);
  fireEvent.click(scrim());
  fireEvent.click(scrim());
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledTimes(1);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("a tap outside closes it even with no cancel action", () => {
  const onOpenChange = vi.fn();
  render(<ActionSheet open onOpenChange={onOpenChange} title="Share" actions={[{ label: "Copy" }]} />);
  fireEvent.click(scrim());
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("a tap inside the sheet, off its buttons, doesn't dismiss it", () => {
  const onOpenChange = vi.fn();
  render(<ActionSheet open onOpenChange={onOpenChange} title="Share" message="Pick one" actions={[{ label: "Copy" }]} />);
  fireEvent.click(screen.getByText("Pick one"));
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("is named by its title, or by aria-label without one", () => {
  const { rerender } = render(<ActionSheet open title="Share" actions={[{ label: "Copy" }]} />);
  expect(dialog().getAttribute("aria-labelledby")).toBe(screen.getByText("Share").id);
  expect(dialog().hasAttribute("aria-label")).toBe(false);
  rerender(<ActionSheet open aria-label="Share options" actions={[{ label: "Copy" }]} />);
  expect(dialog().getAttribute("aria-label")).toBe("Share options");
  expect(dialog().hasAttribute("aria-labelledby")).toBe(false);
});

test("describes itself by its message", () => {
  render(<ActionSheet open title="Share" message="Pick one" actions={[{ label: "Copy" }]} />);
  expect(dialog().getAttribute("aria-describedby")).toBe(screen.getByText("Pick one").id);
});

test("marks a destructive action", () => {
  render(<ActionSheet open title="Delete?" actions={[{ label: "Delete", role: "destructive" }, { label: "Keep" }]} />);
  expect(screen.getByText("Delete", { selector: "button" }).hasAttribute("data-destructive")).toBe(true);
  expect(screen.getByText("Keep").hasAttribute("data-destructive")).toBe(false);
});

test("takes focus itself, so no row comes up ringed as it opens", () => {
  render(<ActionSheet defaultOpen title="Share" actions={[{ label: "Copy" }]} />);
  expect(document.activeElement).toBe(dialog());
});

test("up and down move between the choices without going past either end", () => {
  render(<ActionSheet open title="Share" actions={[{ label: "Copy" }, { label: "Mail" }, { label: "Cancel", role: "cancel" }]} />);
  const [copy, mail, cancel] = rows();
  fireEvent.keyDown(dialog(), { key: "ArrowDown" });
  expect(document.activeElement).toBe(copy);
  fireEvent.keyDown(copy!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(mail);
  fireEvent.keyDown(mail!, { key: "ArrowDown" });
  fireEvent.keyDown(cancel!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(cancel);
  fireEvent.keyDown(cancel!, { key: "ArrowUp" });
  expect(document.activeElement).toBe(mail);
  fireEvent.keyDown(mail!, { key: "Home" });
  expect(document.activeElement).toBe(copy);
  fireEvent.keyDown(copy!, { key: "ArrowUp" });
  expect(document.activeElement).toBe(copy);
  fireEvent.keyDown(copy!, { key: "End" });
  expect(document.activeElement).toBe(cancel);
});

test("up from the dialog itself starts at the last choice", () => {
  render(<ActionSheet open title="Share" actions={[{ label: "Copy" }, { label: "Mail" }]} />);
  fireEvent.keyDown(dialog(), { key: "ArrowUp" });
  expect(document.activeElement).toBe(rows()[1]);
});

test("two open at once keep their own labels", () => {
  render(
    <>
      <ActionSheet open title="First" actions={[{ label: "A" }]} />
      <ActionSheet open title="Second" actions={[{ label: "B" }]} />
    </>,
  );
  const [first, second] = [...document.querySelectorAll("dialog")];
  expect(first!.getAttribute("aria-labelledby")).not.toBe(second!.getAttribute("aria-labelledby"));
});
