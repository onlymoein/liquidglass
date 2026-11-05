import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { ContextMenu } from "../src";

const items = [{ label: "Copy", onSelect: vi.fn() }, "separator" as const, { label: "Delete", destructive: true }];

test("opens on a right-click and runs the chosen item", () => {
  const onOpenChange = vi.fn();
  render(<ContextMenu aria-label="Photo" items={items} onOpenChange={onOpenChange}><img alt="Photo" /></ContextMenu>);
  fireEvent.contextMenu(screen.getByAltText("Photo"));
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
  expect(items[0]).toBeTruthy();
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

test("opens when a finger holds still, not when it wanders", () => {
  vi.useFakeTimers();
  const onOpenChange = vi.fn();
  render(<ContextMenu items={items} onOpenChange={onOpenChange}><span>Hold</span></ContextMenu>);
  const target = screen.getByText("Hold");
  fireEvent.pointerDown(target, { button: 0, pointerType: "touch", clientX: 0, clientY: 0 });
  fireEvent.pointerMove(target, { clientX: 0, clientY: 40 });
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(onOpenChange).not.toHaveBeenCalled();
  fireEvent.pointerDown(target, { button: 0, pointerType: "touch", clientX: 0, clientY: 0 });
  act(() => {
    vi.advanceTimersByTime(600);
  });
  expect(onOpenChange).toHaveBeenCalledWith(true);
  vi.useRealTimers();
});
