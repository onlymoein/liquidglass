import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Menu } from "../src";

const open = () => fireEvent.click(screen.getByRole("button", { name: "Options" }));

test("opens, focuses the first item and selects", () => {
  const onPin = vi.fn();
  render(
    <Menu
      aria-label="Options"
      items={[{ label: "Pin", onSelect: onPin }, "separator", { label: "Delete", destructive: true }]}
    />,
  );
  open();

  expect(screen.getByRole("menu", { name: "Options" })).toBeTruthy();
  expect(screen.getByRole("separator")).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Pin" }));
  expect(screen.getByRole("menuitem", { name: "Delete" }).hasAttribute("data-destructive")).toBe(true);

  fireEvent.click(screen.getByRole("menuitem", { name: "Pin" }));
  expect(onPin).toHaveBeenCalledOnce();
});

test("closes on Escape and returns focus to the trigger", async () => {
  vi.useFakeTimers();
  render(<Menu aria-label="Options" items={[{ label: "Pin" }]} />);
  open();

  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Pin" }), { key: "Escape" });
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Options" }));
  vi.useRealTimers();
});

test("skips disabled items with the arrow keys", () => {
  render(<Menu aria-label="Options" items={[{ label: "Pin" }, { label: "Rename", disabled: true }, { label: "Delete" }]} />);
  open();

  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Pin" }), { key: "ArrowDown" });
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Delete" }));
});

test("opens and closes when its owner says so", async () => {
  vi.useFakeTimers();
  const { rerender } = render(<Menu aria-label="Options" items={[{ label: "Pin" }]} open />);
  expect(screen.getByRole("menu", { name: "Options" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Options" }).getAttribute("aria-expanded")).toBe("true");

  rerender(<Menu aria-label="Options" items={[{ label: "Pin" }]} open={false} />);
  expect(screen.getByRole("menu").dataset.phase).toBe("leaving");
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Options" }));
  vi.useRealTimers();
});

test("asks its owner to open and close, and stays open until it agrees", () => {
  const onOpenChange = vi.fn();
  const { rerender } = render(<Menu aria-label="Options" items={[{ label: "Pin" }]} open={false} onOpenChange={onOpenChange} />);
  open();
  expect(onOpenChange).toHaveBeenLastCalledWith(true);
  expect(screen.queryByRole("menu")).toBeNull();

  rerender(<Menu aria-label="Options" items={[{ label: "Pin" }]} open onOpenChange={onOpenChange} />);
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Pin" }), { key: "Escape" });
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole("menu").dataset.phase).toBe("open");
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Pin" }));
});

test("reports each change once", () => {
  const onOpenChange = vi.fn();
  render(<Menu aria-label="Options" items={[{ label: "Pin" }]} defaultOpen onOpenChange={onOpenChange} />);
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Pin" }), { key: "Escape" });
  fireEvent.pointerDown(document.body);
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
});

test("gives a labelled trigger its label as its name, and a chevron", () => {
  render(<Menu aria-label="Shipment options" label="Create shipment" items={[{ label: "Parcel" }, { label: "Freight" }]} />);
  const trigger = screen.getByRole("button", { name: "Create shipment" });
  expect(trigger.hasAttribute("data-icon")).toBe(false);
  expect(trigger.querySelector(".lg-menu-chevron")).toBeTruthy();

  fireEvent.click(trigger);
  const menu = screen.getByRole("menu", { name: "Shipment options" });
  expect(menu.hasAttribute("data-label")).toBe(true);
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Parcel" }));
});
