import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { Menu } from "../src";

const open = () => fireEvent.click(screen.getByRole("button", { name: "Options" }));

afterEach(() => vi.restoreAllMocks());

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

test("a finger opens it as it lifts, once, and leaves no row ringed", () => {
  render(<Menu aria-label="Options" label="Create" items={[{ label: "Parcel" }]} />);
  const trigger = screen.getByRole("button", { name: "Create" });
  fireEvent.pointerUp(trigger, { pointerType: "touch", clientX: 0, clientY: 0 });
  const menu = screen.getByRole("menu");
  expect(menu.dataset.phase).toBe("open");
  expect(document.activeElement).toBe(menu);
  fireEvent.click(trigger);
  expect(menu.dataset.phase).toBe("open");
});

// jsdom lays nothing out, so a trigger at the bottom of the window and a tall card stand in for a menu with no room below.
function opensUpward() {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.classList.contains("lg-menu-card") ? 400 : 40;
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const box = this.hasAttribute("aria-haspopup") ? { left: 100, top: 700, width: 100, height: 40 } : { left: 0, top: 0, width: 0, height: 0 };
    return { ...box, right: box.left + box.width, bottom: box.top + box.height, x: box.left, y: box.top, toJSON() {} } as DOMRect;
  });
}

const listed = () =>
  [...screen.getByRole("menu", { hidden: true }).querySelectorAll(".lg-menu-item, .lg-menu-heading, .lg-menu-separator")].map((row) =>
    row.classList.contains("lg-menu-separator") ? "-" : row.textContent,
  );

test("lists its items from the bottom when it opens upward, as iOS does", () => {
  opensUpward();
  const onB = vi.fn();
  const onC = vi.fn();
  render(
    <Menu
      aria-label="Options"
      items={[
        { label: "A" },
        "separator",
        { heading: "Sort" },
        { label: "B", checked: true, onSelect: onB },
        { label: "C", checked: false, onSelect: onC },
      ]}
    />,
  );
  open();

  const card = screen.getByRole("menu", { hidden: true });
  expect(card.getAttribute("data-side")).toBe("top");
  expect(listed()).toEqual(["Sort", "C", "B", "-", "A"]);

  // The first row on screen is the one the keyboard starts on, and the arrows follow the screen.
  const [c, b] = [screen.getByRole("menuitemradio", { name: "C", hidden: true }), screen.getByRole("menuitemradio", { name: "B", hidden: true })];
  expect(document.activeElement).toBe(c);
  fireEvent.keyDown(c, { key: "ArrowDown" });
  expect(document.activeElement).toBe(b);

  // Each row is still the item it was in `items`.
  fireEvent.click(c);
  expect(onC).toHaveBeenCalledOnce();
  expect(onB).not.toHaveBeenCalled();
});

test("lists its items in their own order when it opens downward", () => {
  render(<Menu aria-label="Options" items={[{ label: "A" }, "separator", { label: "B" }, { label: "C" }]} />);
  open();
  expect(screen.getByRole("menu").getAttribute("data-side")).toBe("bottom");
  expect(listed()).toEqual(["A", "-", "B", "C"]);
});

test("goes back to its own order when it's opened again with room below", () => {
  vi.useFakeTimers();
  opensUpward();
  render(<Menu aria-label="Options" items={[{ label: "A" }, { label: "B" }]} />);
  open();
  expect(listed()).toEqual(["B", "A"]);

  fireEvent.keyDown(screen.getByRole("menuitem", { name: "B", hidden: true }), { key: "Escape" });
  act(() => vi.runAllTimers());
  expect(screen.queryByRole("menu", { hidden: true })).toBeNull();

  vi.restoreAllMocks();
  open();
  expect(listed()).toEqual(["A", "B"]);
  vi.useRealTimers();
});

test("leaves a gutter on every row for the checkmarks when any item is a choice", () => {
  render(<Menu aria-label="Options" items={[{ label: "Copy" }, { heading: "Sort" }, { label: "Name", checked: true }, { label: "Date", checked: false }]} />);
  open();
  expect(screen.getByRole("menu").hasAttribute("data-gutter")).toBe(true);
});

test("leaves no gutter where nothing is a choice", () => {
  render(<Menu aria-label="Options" items={[{ label: "Copy" }, { label: "Share" }]} />);
  open();
  expect(screen.getByRole("menu").hasAttribute("data-gutter")).toBe(false);
});
