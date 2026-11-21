import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

const sortItems = (onName = vi.fn(), onPin = vi.fn()) => [
  { label: "Pin", onSelect: onPin },
  { label: "Sort by", items: [{ label: "Name", onSelect: onName }, { label: "Date" }] },
  "separator" as const,
  { label: "Delete" },
];

test("a submenu's row opens a second card over the menu, titled with the row", () => {
  render(<Menu aria-label="Options" items={sortItems()} />);
  open();
  const row = screen.getByRole("menuitem", { name: "Sort by" });
  expect(row.getAttribute("aria-haspopup")).toBe("menu");
  expect(row.getAttribute("aria-expanded")).toBe("false");
  expect(row.querySelector(".lg-menu-more")).toBeTruthy();
  expect(screen.getByRole("menuitem", { name: "Pin" }).hasAttribute("aria-haspopup")).toBe(false);

  fireEvent.click(row);
  expect(row.getAttribute("aria-expanded")).toBe("true");
  const card = screen.getByRole("menu", { name: "Options" });
  const sub = within(card).getByRole("menu", { name: "Sort by" });
  const title = within(sub).getAllByRole("menuitem")[0]!;
  expect(title.textContent).toBe("Sort by");
  expect(title.classList.contains("lg-menu-sub-head")).toBe(true);
  expect(within(sub).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Sort by", "Name", "Date"]);
  expect(within(sub).getByRole("separator")).toBeTruthy();
  // What it covers can't be reached, by a key or a reader, while it's up.
  expect(card.querySelector(":scope > .lg-menu-content")!.hasAttribute("inert")).toBe(true);
  expect(card.hasAttribute("data-receder")).toBe(true);
});

test("choosing an item of a submenu selects it and closes the whole menu", async () => {
  vi.useFakeTimers();
  const onName = vi.fn();
  const onPin = vi.fn();
  const onOpenChange = vi.fn();
  render(<Menu aria-label="Options" items={sortItems(onName, onPin)} onOpenChange={onOpenChange} />);
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Sort by" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "Name" }));

  // The one at the same index in the menu itself is not the one chosen.
  expect(onName).toHaveBeenCalledOnce();
  expect(onPin).not.toHaveBeenCalled();
  expect(onOpenChange).toHaveBeenLastCalledWith(false);
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu")).toBeNull();

  // It opens again as the menu it was, with no submenu left over it.
  open();
  expect(screen.getAllByRole("menu")).toHaveLength(1);
  expect(screen.getByRole("menuitem", { name: "Sort by" }).getAttribute("aria-expanded")).toBe("false");
  vi.useRealTimers();
});

test("a submenu stays open for a choice that keeps the menu open", () => {
  const onSelect = vi.fn();
  render(<Menu aria-label="Options" items={[{ label: "Sort by", items: [{ label: "Name", checked: true, keepOpen: true, onSelect }] }]} />);
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Sort by" }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Name" }));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(screen.getByRole("menu", { name: "Options" }).dataset.phase).toBe("open");
  expect(screen.getByRole("menu", { name: "Sort by" })).toBeTruthy();
});

test("choosing the title folds the submenu back into its row", async () => {
  vi.useFakeTimers();
  render(<Menu aria-label="Options" items={sortItems()} />);
  open();
  const row = screen.getByRole("menuitem", { name: "Sort by" });
  fireEvent.click(row);
  const sub = screen.getByRole("menu", { name: "Sort by" });
  fireEvent.click(within(sub).getAllByRole("menuitem")[0]!);

  // Folding, it's shut already, and what it covered works again.
  expect(row.getAttribute("aria-expanded")).toBe("false");
  expect(sub.hasAttribute("data-leaving")).toBe(true);
  const card = screen.getByRole("menu", { name: "Options" });
  expect(card.querySelector(":scope > .lg-menu-content")!.hasAttribute("inert")).toBe(false);
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu", { name: "Sort by" })).toBeNull();
  expect(card.dataset.phase).toBe("open");
  expect(card.hasAttribute("data-receder")).toBe(false);
  expect(card.style.getPropertyValue("--lg-recede")).toBe("");
  vi.useRealTimers();
});

test("Escape folds a submenu first, and the menu next", async () => {
  vi.useFakeTimers();
  render(<Menu aria-label="Options" items={sortItems()} />);
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Sort by" }));
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu", { name: "Sort by" })).toBeNull();
  expect(screen.getByRole("menu", { name: "Options" }).dataset.phase).toBe("open");

  fireEvent.keyDown(screen.getByRole("menu", { name: "Options" }), { key: "Escape" });
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu")).toBeNull();
  vi.useRealTimers();
});

test("the arrow keys open a submenu, move within it and fold it back to its row", async () => {
  vi.useFakeTimers();
  render(<Menu aria-label="Options" items={sortItems()} />);
  open();
  const row = screen.getByRole("menuitem", { name: "Sort by" });
  row.focus();
  fireEvent.keyDown(row, { key: "ArrowRight" });
  // A key starts on the first item, under the title.
  const name = screen.getByRole("menuitem", { name: "Name" });
  expect(document.activeElement).toBe(name);

  fireEvent.keyDown(name, { key: "ArrowDown" });
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Date" }));
  // The menu behind it has no part in the keys.
  fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
  const title = within(screen.getByRole("menu", { name: "Sort by" })).getAllByRole("menuitem")[0];
  expect(document.activeElement).toBe(title);
  fireEvent.keyDown(document.activeElement!, { key: "End" });
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Date" }));

  fireEvent.keyDown(document.activeElement!, { key: "ArrowLeft" });
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu", { name: "Sort by" })).toBeNull();
  expect(document.activeElement).toBe(row);
  vi.useRealTimers();
});

test("a submenu opens another over it, and folding the first takes both", async () => {
  vi.useFakeTimers();
  const onRaw = vi.fn();
  render(
    <Menu
      aria-label="Options"
      items={[{ label: "Export", items: [{ label: "Pin" }, { label: "As", items: [{ label: "CSV" }, { label: "Raw", onSelect: onRaw }] }] }]}
    />,
  );
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Export" }));
  fireEvent.click(screen.getByRole("menuitem", { name: "As" }));
  const as = screen.getByRole("menu", { name: "As" });
  expect(screen.getAllByRole("menu")).toHaveLength(3);
  // Each is over the one that has its row.
  const first = screen.getByRole("menu", { name: "Export" });
  expect(first.hasAttribute("data-receder")).toBe(true);
  expect(first.querySelector(":scope > .lg-menu-content")!.hasAttribute("inert")).toBe(true);
  expect(screen.getByRole("menu", { name: "Options" }).hasAttribute("data-receder")).toBe(true);

  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu", { name: "As" })).toBeNull();
  expect(first.hasAttribute("data-receder")).toBe(false);
  expect(screen.getByRole("menu", { name: "Export" })).toBe(first);

  fireEvent.click(screen.getByRole("menuitem", { name: "As" }));
  fireEvent.click(within(screen.getByRole("menu", { name: "As" })).getByRole("menuitem", { name: "Raw" }));
  expect(onRaw).toHaveBeenCalledOnce();
  expect(as.isConnected).toBe(false);
  vi.useRealTimers();
});

test("the menu closing takes its submenus with it", async () => {
  vi.useFakeTimers();
  const { rerender } = render(<Menu aria-label="Options" items={sortItems()} open />);
  fireEvent.click(screen.getByRole("menuitem", { name: "Sort by" }));
  expect(screen.getAllByRole("menu")).toHaveLength(2);

  rerender(<Menu aria-label="Options" items={sortItems()} open={false} />);
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu")).toBeNull();
  vi.useRealTimers();
});

test("a press on the menu behind a submenu folds it, and chooses nothing", async () => {
  vi.useFakeTimers();
  const onPin = vi.fn();
  render(<Menu aria-label="Options" items={sortItems(vi.fn(), onPin)} />);
  open();
  fireEvent.click(screen.getByRole("menuitem", { name: "Sort by" }));
  const card = screen.getByRole("menu", { name: "Options" });
  // jsdom doesn't lay anything out, so says what is under the finger.
  document.elementFromPoint = () => card;
  fireEvent.pointerDown(card, { pointerId: 1, isPrimary: true, button: 0, clientX: 4, clientY: 4 });
  fireEvent.pointerUp(card, { pointerId: 1, isPrimary: true, button: 0, clientX: 4, clientY: 4 });
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu", { name: "Sort by" })).toBeNull();
  expect(onPin).not.toHaveBeenCalled();
  expect(card.dataset.phase).toBe("open");
  delete (document as Partial<Document>).elementFromPoint;
  vi.useRealTimers();
});

test("a submenu's row has no link or choice of its own", () => {
  const onSelect = vi.fn();
  render(<Menu aria-label="Options" items={[{ label: "More", href: "/more", checked: true, onSelect, items: [{ label: "Name" }] }]} />);
  open();
  const row = screen.getByRole("menuitem", { name: "More" });
  expect(row.tagName).toBe("BUTTON");
  expect(row.hasAttribute("href")).toBe(false);
  fireEvent.click(row);
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByRole("menu", { name: "More" })).toBeTruthy();
});

test("a submenu that's gone from the items goes from the screen", () => {
  const { rerender } = render(<Menu aria-label="Options" items={sortItems()} open />);
  fireEvent.click(screen.getByRole("menuitem", { name: "Sort by" }));
  rerender(<Menu aria-label="Options" items={[{ label: "Pin" }]} open />);
  expect(screen.queryByRole("menu", { name: "Sort by" })).toBeNull();
});
