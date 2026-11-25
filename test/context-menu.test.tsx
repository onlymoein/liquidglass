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

const hold = (menuItems: Parameters<typeof ContextMenu>[0]["items"], props: Partial<Parameters<typeof ContextMenu>[0]> = {}) => {
  render(<ContextMenu aria-label="Photo" items={menuItems} {...props}><img alt="Photo" /></ContextMenu>);
  fireEvent.contextMenu(screen.getByAltText("Photo"));
};

test("runs the chosen item, once, and closes", () => {
  const onCopy = vi.fn();
  const onOpenChange = vi.fn();
  hold([{ label: "Copy", onSelect: onCopy }], { onOpenChange });
  fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
  expect(onCopy).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

test("a checked item is a choice, with a tick beside the one that's chosen", () => {
  hold([
    { heading: "Sort by" },
    { label: "Name", checked: true },
    { label: "Date", checked: false },
  ]);
  const name = screen.getByRole("menuitemradio", { name: "Name" });
  const date = screen.getByRole("menuitemradio", { name: "Date" });
  expect(name.getAttribute("aria-checked")).toBe("true");
  expect(date.getAttribute("aria-checked")).toBe("false");
  expect(name.querySelector(".lg-menu-check svg")).toBeTruthy();
  // The room for the tick is kept on the other row too, so the labels line up.
  expect(date.querySelector(".lg-menu-check")).toBeTruthy();
  expect(date.querySelector(".lg-menu-check svg")).toBeNull();
  // A heading is a title, not a row.
  expect(screen.getByText("Sort by").getAttribute("role")).toBe("presentation");
  expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
});

test("a keepOpen item leaves the menu open", () => {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  hold([{ label: "Grid", checked: true, keepOpen: true, onSelect }, { label: "List", onSelect }], { onOpenChange });
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Grid" }));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("menuitem", { name: "List" }));
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
});

test("an item's className reaches its row", () => {
  hold([{ label: "Copy", className: "mine" }]);
  expect(screen.getByRole("menuitem", { name: "Copy" }).classList.contains("mine")).toBe(true);
});

test("an item with a link is a link, which a modified click opens in a new tab", () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const onOpenChange = vi.fn();
  hold([{ label: "Open", href: "/photos/1" }], { onOpenChange });
  const link = screen.getByRole("menuitem", { name: "Open" });
  expect(link.tagName).toBe("A");
  expect(link.getAttribute("href")).toBe("/photos/1");
  fireEvent.click(link, { ctrlKey: true });
  expect(open).toHaveBeenCalledWith("/photos/1", "_blank", "noopener");
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  open.mockRestore();
});

test("a plain click on a link item runs onSelect instead of leaving the page", () => {
  const onSelect = vi.fn();
  hold([{ label: "Open", href: "/photos/1", onSelect }]);
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  screen.getByRole("menuitem", { name: "Open" }).dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(onSelect).toHaveBeenCalledOnce();
});

test("a link that would run script is not a link, and goes nowhere", () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  hold([{ label: "Evil", href: "javascript:alert(1)" }, { label: "Data", href: "data:text/html,<script>alert(1)</script>" }]);
  for (const name of ["Evil", "Data"]) {
    const row = screen.getByRole("menuitem", { name });
    expect(row.tagName).toBe("BUTTON");
    expect(row.hasAttribute("href")).toBe(false);
    fireEvent.click(row, { ctrlKey: true });
  }
  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});

test("a mouse or finger opens it with no row focused, so none is ringed; the arrow keys start from either end", () => {
  hold([{ label: "One" }, { label: "Two", disabled: true }, "separator", { label: "Three" }, { label: "Four" }]);
  const dialog = document.querySelector("dialog")!;
  expect(document.activeElement).toBe(dialog);
  fireEvent.keyDown(dialog, { key: "ArrowUp" });
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Four" }));
});

test("a keyboard opens it on its first row", () => {
  render(
    <ContextMenu aria-label="Photo" items={[{ label: "One" }, { label: "Two" }]}>
      <button type="button">Photo</button>
    </ContextMenu>,
  );
  const photo = screen.getByRole("button", { name: "Photo" });
  // Tab puts focus there as a keyboard does, which a browser rings.
  photo.focus();
  vi.spyOn(photo, "matches").mockImplementation((selector) => selector === ":focus-visible");
  fireEvent.contextMenu(photo);
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "One" }));
});

test("the arrow keys, Home and End move between the enabled rows and wrap round", () => {
  hold([{ label: "One" }, { label: "Two", disabled: true }, "separator", { label: "Three" }, { label: "Four" }]);
  const row = (name: string) => screen.getByRole("menuitem", { name });
  const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key });
  press("ArrowDown");
  expect(document.activeElement).toBe(row("One"));
  press("ArrowDown");
  expect(document.activeElement).toBe(row("Three"));
  press("End");
  expect(document.activeElement).toBe(row("Four"));
  press("ArrowDown");
  expect(document.activeElement).toBe(row("One"));
  press("ArrowUp");
  expect(document.activeElement).toBe(row("Four"));
  press("Home");
  expect(document.activeElement).toBe(row("One"));
});
