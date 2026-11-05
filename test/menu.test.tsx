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

test("gives a labelled trigger its label as its name, and a chevron when asked", () => {
  render(<Menu aria-label="Shipment options" label="Create shipment" chevron items={[{ label: "Parcel" }, { label: "Freight" }]} />);
  const trigger = screen.getByRole("button", { name: "Create shipment" });
  expect(trigger.hasAttribute("data-icon")).toBe(false);
  expect(trigger.querySelector(".lg-menu-chevron")).toBeTruthy();

  fireEvent.click(trigger);
  const menu = screen.getByRole("menu", { name: "Shipment options" });
  expect(menu.hasAttribute("data-label")).toBe(true);
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Parcel" }));
});

test("follows a link item through onSelect, or in a new tab with a modifier", () => {
  const navigate = vi.fn();
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  render(<Menu aria-label="Options" items={[{ label: "Freight", href: "/ship?mode=pallets", onSelect: navigate }]} />);

  fireEvent.click(screen.getByRole("button", { name: "Options" }));
  const link = screen.getByRole("menuitem", { name: "Freight" });
  expect(link.getAttribute("href")).toBe("/ship?mode=pallets");
  expect(fireEvent.click(link)).toBe(false);
  expect(navigate).toHaveBeenCalledOnce();

  fireEvent.click(screen.getByRole("button", { name: "Options" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Freight" }), { metaKey: true });
  expect(open).toHaveBeenCalledWith("/ship?mode=pallets", "_blank", "noopener");
  expect(navigate).toHaveBeenCalledOnce();
  open.mockRestore();
});

test("hands the trigger its own props", () => {
  render(<Menu aria-label="Options" label="Create" trigger={{ variant: "filled", className: "primary" }} items={[{ label: "Pin" }]} />);
  const trigger = screen.getByRole("button", { name: "Create" });
  expect(trigger.dataset.variant).toBe("filled");
  expect(trigger.className).toBe("lg-glass lg-button primary");
});

test("titles a section with a heading, and checks the chosen one of a set", () => {
  const onDark = vi.fn();
  render(
    <Menu
      aria-label="Appearance"
      items={[
        { heading: "Appearance" },
        { label: "Light", checked: false },
        { label: "Dark", checked: true, onSelect: onDark, keepOpen: true },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Appearance" }));

  expect(screen.getByText("Appearance", { selector: ".lg-menu-heading" }).getAttribute("role")).toBe("presentation");
  const dark = screen.getByRole("menuitemradio", { name: "Dark" });
  expect(dark.getAttribute("aria-checked")).toBe("true");
  expect(dark.querySelector(".lg-menu-check svg")).toBeTruthy();
  expect(screen.getByRole("menuitemradio", { name: "Light" }).getAttribute("aria-checked")).toBe("false");
  expect(screen.getByRole("menuitemradio", { name: "Light" }).querySelector(".lg-menu-check svg")).toBeNull();

  // A setting stays open, so the change can be seen.
  fireEvent.click(dark);
  expect(onDark).toHaveBeenCalledOnce();
  expect(screen.getByRole("menu").dataset.phase).toBe("open");
});

test("leaves the heading out when arrows move between items", () => {
  render(<Menu aria-label="Options" items={[{ heading: "Sort" }, { label: "Newest" }, { label: "Oldest" }]} />);
  open();
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Newest" }));
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Oldest" }));
});

test("keeps Escape from closing whatever it opened over", () => {
  const behind = vi.fn();
  document.addEventListener("keydown", behind);
  render(<Menu aria-label="Options" items={[{ label: "Pin" }]} />);
  open();
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Pin" }), { key: "Escape" });
  expect(behind).not.toHaveBeenCalled();
  document.removeEventListener("keydown", behind);
});

test("goes in the top layer where there is one, and gives each item its own class", () => {
  const showPopover = vi.fn();
  const hidePopover = vi.fn();
  Object.assign(HTMLElement.prototype, { showPopover, hidePopover });
  try {
    render(<Menu aria-label="Options" items={[{ label: "Reply", className: "touch-only" }]} />);
    open();
    // jsdom hides a popover the stand-in never really showed, so look past that.
    expect(screen.getByRole("menu", { hidden: true }).getAttribute("popover")).toBe("manual");
    expect(showPopover).toHaveBeenCalledOnce();
    expect(screen.getByRole("menuitem", { name: "Reply", hidden: true }).className).toBe("lg-menu-item touch-only");
  } finally {
    delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
    delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
  }
});

test("leaves the popover attribute off where there are no popovers, so nothing hides it", () => {
  render(<Menu aria-label="Options" items={[{ label: "Pin" }]} />);
  open();
  expect(screen.getByRole("menu").hasAttribute("popover")).toBe(false);
});

test("leaves the chevron off a labelled trigger by default, as iOS does", () => {
  render(<Menu aria-label="Account" label="Dana" items={[{ label: "Settings" }]} />);
  const trigger = screen.getByRole("button", { name: "Dana" });
  expect(trigger.querySelector(".lg-menu-chevron")).toBeNull();
  fireEvent.click(trigger);
  expect(screen.getByRole("menu").querySelector(".lg-menu-chevron")).toBeNull();
});

test("lets a labelled trigger be named for what it opens", () => {
  render(<Menu aria-label="Account" label="Dana" trigger={{ "aria-label": "Account menu" }} items={[{ label: "Settings" }]} />);
  expect(screen.getByRole("button", { name: "Account menu" })).toBeTruthy();
});

test("passes over a row its own class hides", () => {
  render(<Menu aria-label="Options" items={[{ label: "React", className: "gone" }, { label: "Copy" }, { label: "Pin" }]} />);
  const style = document.createElement("style");
  style.textContent = ".gone { display: none; }";
  document.head.append(style);
  open();
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Copy" }));
  fireEvent.keyDown(document.activeElement!, { key: "End" });
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Copy" }));
  style.remove();
});
