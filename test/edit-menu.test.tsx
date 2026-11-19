import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { EditMenu } from "../src";

const items = [{ label: "Cut" }, { label: "Copy" }, { label: "Paste" }];
const anchor = { left: 150, top: 300, width: 100, height: 20 };

// jsdom has no layout: the card is 44 tall, and each item 100 wide, which is what the menu measures.
const { offsetWidth, offsetHeight } = Object.getOwnPropertyDescriptors(HTMLElement.prototype);
const innerWidth = window.innerWidth;
const innerHeight = window.innerHeight;

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      if (this.hasAttribute("data-item")) return 100;
      if (this.classList.contains("lg-edit-more")) return 40;
      return this.classList.contains("lg-edit-menu") ? 200 : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return this.classList.contains("lg-edit-menu") ? 44 : 0;
    },
  });
  Object.assign(window, { innerWidth: 400, innerHeight: 800 });
});

afterEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", offsetWidth!);
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight!);
  Object.assign(window, { innerWidth, innerHeight });
  vi.useRealTimers();
});

test("shows its items beside the selection, and runs the one that's pressed", () => {
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  render(<EditMenu open anchor={anchor} items={[{ label: "Cut" }, { label: "Copy", onSelect }]} onOpenChange={onOpenChange} />);
  expect(screen.getByRole("menu", { name: "Edit" })).toBeTruthy();
  fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("shows nothing when it's closed, or points at nothing", () => {
  const { rerender } = render(<EditMenu open={false} anchor={anchor} items={items} />);
  expect(screen.queryByRole("menu")).toBeNull();
  rerender(<EditMenu open anchor={null} items={items} />);
  expect(screen.queryByRole("menu")).toBeNull();
  rerender(<EditMenu open anchor={anchor} items={items} />);
  expect(screen.getByRole("menu")).toBeTruthy();
});

test("is named by its aria-label", () => {
  render(<EditMenu open anchor={anchor} items={items} aria-label="Text" />);
  expect(screen.getByRole("menu", { name: "Text" })).toBeTruthy();
});

test("is set above the selection, centred on it", () => {
  render(<EditMenu open anchor={anchor} items={items} />);
  const card = screen.getByRole("menu");
  expect(card.style.left).toBe("100px");
  expect(card.style.top).toBe(`${300 - 10 - 44}px`);
  expect(card.dataset.side).toBe("top");
  expect(card.hasAttribute("data-placed")).toBe(true);
});

test("goes below the selection near the top of the window", () => {
  render(<EditMenu open anchor={{ left: 150, top: 20, width: 100, height: 20 }} items={items} />);
  const card = screen.getByRole("menu");
  expect(card.dataset.side).toBe("bottom");
  expect(card.style.top).toBe("50px");
});

test("a point works as an anchor, and so does anything that says where it is", () => {
  const { unmount } = render(<EditMenu open anchor={{ left: 200, top: 300 }} items={items} />);
  expect(screen.getByRole("menu").style.left).toBe("100px");
  unmount();

  const element = document.createElement("p");
  element.getBoundingClientRect = () => ({ left: 150, top: 300, width: 100, height: 20 }) as DOMRect;
  render(<EditMenu open anchor={element} items={items} />);
  expect(screen.getByRole("menu").style.left).toBe("100px");
});

test("follows its anchor as the page scrolls, and hides when it's gone", () => {
  let top = 300;
  const range = { getBoundingClientRect: () => ({ left: 150, top, width: 100, height: 20 }) };
  render(<EditMenu open anchor={range} items={items} />);
  const card = screen.getByRole("menu");
  expect(card.style.top).toBe("246px");

  top = 200;
  fireEvent.scroll(window);
  expect(card.style.top).toBe("146px");

  top = -500;
  fireEvent.scroll(window);
  expect(card.hasAttribute("data-hidden")).toBe(true);

  top = 300;
  fireEvent.scroll(window);
  expect(card.hasAttribute("data-hidden")).toBe(false);
});

test("goes to a new anchor", () => {
  const { rerender } = render(<EditMenu open anchor={anchor} items={items} />);
  rerender(<EditMenu open anchor={{ left: 150, top: 500, width: 100, height: 20 }} items={items} />);
  expect(screen.getByRole("menu").style.top).toBe(`${500 - 10 - 44}px`);
});

test("leaves the focus, and the selection, where they were", () => {
  render(
    <>
      <input aria-label="Note" defaultValue="Some text" />
      <EditMenu open anchor={anchor} items={items} />
    </>,
  );
  const input = screen.getByRole("textbox");
  input.focus();
  expect(document.activeElement).toBe(input);
  // Pressing it would move the focus, which is stopped.
  expect(fireEvent.mouseDown(screen.getByRole("menuitem", { name: "Copy" }))).toBe(false);
  expect(document.activeElement).toBe(input);
});

test("Escape asks to close it, wherever focus is", () => {
  const onOpenChange = vi.fn();
  render(
    <>
      <input aria-label="Note" />
      <EditMenu open anchor={anchor} items={items} onOpenChange={onOpenChange} />
    </>,
  );
  screen.getByRole("textbox").focus();
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("a press outside asks to close it; one on it doesn't", () => {
  const onOpenChange = vi.fn();
  render(
    <>
      <p>Text</p>
      <EditMenu open anchor={anchor} items={items} onOpenChange={onOpenChange} />
    </>,
  );
  fireEvent.pointerDown(screen.getByRole("menuitem", { name: "Paste" }));
  expect(onOpenChange).not.toHaveBeenCalled();
  fireEvent.pointerDown(screen.getByText("Text"));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("runs when uncontrolled: closes on its own after an item", async () => {
  vi.useFakeTimers();
  render(<EditMenu defaultOpen anchor={anchor} items={[{ label: "Copy" }]} />);
  fireEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
  expect(screen.getByRole("menu").dataset.phase).toBe("leaving");
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu")).toBeNull();
});

test("stays open until its owner agrees when it's controlled", async () => {
  vi.useFakeTimers();
  const onOpenChange = vi.fn();
  const { rerender } = render(<EditMenu open anchor={anchor} items={items} onOpenChange={onOpenChange} />);
  fireEvent.keyDown(document.body, { key: "Escape" });
  expect(onOpenChange).toHaveBeenCalledWith(false);
  expect(screen.getByRole("menu").dataset.phase).toBe("open");

  rerender(<EditMenu open={false} anchor={anchor} items={items} onOpenChange={onOpenChange} />);
  expect(screen.getByRole("menu").dataset.phase).toBe("leaving");
  await act(() => vi.runAllTimersAsync());
  expect(screen.queryByRole("menu")).toBeNull();
});

test("a disabled item can't be pressed", () => {
  const onSelect = vi.fn();
  render(<EditMenu open anchor={anchor} items={[{ label: "Paste", disabled: true, onSelect }, { label: "Copy" }]} />);
  fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));
  expect(onSelect).not.toHaveBeenCalled();
});

test("left and right go from one item to the next", () => {
  render(<EditMenu open anchor={anchor} items={items} />);
  const [cut, copy, paste] = screen.getAllByRole("menuitem");
  cut!.focus();
  fireEvent.keyDown(cut!, { key: "ArrowRight" });
  expect(document.activeElement).toBe(copy);
  fireEvent.keyDown(copy!, { key: "End" });
  expect(document.activeElement).toBe(paste);
  fireEvent.keyDown(paste!, { key: "ArrowRight" });
  expect(document.activeElement).toBe(paste);
  fireEvent.keyDown(paste!, { key: "Home" });
  expect(document.activeElement).toBe(cut);
});

test("items that fit have no chevrons", () => {
  render(<EditMenu open anchor={anchor} items={items} />);
  expect(screen.queryByRole("menuitem", { name: "More items" })).toBeNull();
  expect(screen.getAllByRole("menuitem")).toHaveLength(3);
});

test("items that don't fit are on pages, turned with chevrons", () => {
  // 400 wide leaves 384 for four 100-wide items: the first page has three, then a chevron.
  const four = [{ label: "Cut" }, { label: "Copy" }, { label: "Paste" }, { label: "Select All" }];
  render(<EditMenu open anchor={anchor} items={four} />);
  expect(screen.getAllByRole("menuitem").map((item) => item.getAttribute("aria-label") ?? item.textContent)).toEqual(["Cut", "Copy", "Paste", "More items"]);
});

test("the chevrons turn the page, and focus stays on a chevron", () => {
  Object.assign(window, { innerWidth: 300 });
  const four = [{ label: "Cut" }, { label: "Copy" }, { label: "Paste" }, { label: "Select All" }];
  render(<EditMenu open anchor={anchor} items={four} />);
  const names = () => screen.getAllByRole("menuitem").map((item) => item.getAttribute("aria-label") ?? item.textContent);

  // Room is 284: two items and a chevron, then a chevron and two items.
  expect(names()).toEqual(["Cut", "Copy", "More items"]);
  expect(screen.queryByRole("menuitem", { name: "Previous items" })).toBeNull();

  const next = screen.getByRole("menuitem", { name: "More items" });
  next.focus();
  fireEvent.click(next);
  expect(names()).toEqual(["Previous items", "Paste", "Select All"]);
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Previous items" }));

  fireEvent.click(screen.getByRole("menuitem", { name: "Previous items" }));
  expect(names()).toEqual(["Cut", "Copy", "More items"]);
  expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "More items" }));
});

test("turning a page doesn't close the menu, and choosing an item on a later page does", () => {
  Object.assign(window, { innerWidth: 300 });
  const onSelect = vi.fn();
  const onOpenChange = vi.fn();
  const four = [{ label: "Cut" }, { label: "Copy" }, { label: "Paste" }, { label: "Select All", onSelect }];
  render(<EditMenu open anchor={anchor} items={four} onOpenChange={onOpenChange} />);
  fireEvent.click(screen.getByRole("menuitem", { name: "More items" }));
  expect(onOpenChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("menuitem", { name: "Select All" }));
  expect(onSelect).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("opens again on the first page", async () => {
  vi.useFakeTimers();
  Object.assign(window, { innerWidth: 300 });
  const four = [{ label: "Cut" }, { label: "Copy" }, { label: "Paste" }, { label: "Select All" }];
  const { rerender } = render(<EditMenu open anchor={anchor} items={four} />);
  fireEvent.click(screen.getByRole("menuitem", { name: "More items" }));
  expect(screen.queryByRole("menuitem", { name: "Cut" })).toBeNull();

  rerender(<EditMenu open={false} anchor={anchor} items={four} />);
  await act(() => vi.runAllTimersAsync());
  rerender(<EditMenu open anchor={anchor} items={four} />);
  expect(screen.getByRole("menuitem", { name: "Cut" })).toBeTruthy();
});

test("pages again when the window changes width", () => {
  Object.assign(window, { innerWidth: 500 });
  const four = [{ label: "Cut" }, { label: "Copy" }, { label: "Paste" }, { label: "Select All" }];
  render(<EditMenu open anchor={anchor} items={four} />);
  expect(screen.getAllByRole("menuitem")).toHaveLength(4);
  expect(screen.queryByRole("menuitem", { name: "More items" })).toBeNull();

  act(() => {
    Object.assign(window, { innerWidth: 300 });
    fireEvent(window, new Event("resize"));
  });
  expect(screen.getByRole("menuitem", { name: "More items" })).toBeTruthy();
});

test("measures again when the items change", () => {
  const { rerender } = render(<EditMenu open anchor={anchor} items={items} />);
  expect(screen.getAllByRole("menuitem")).toHaveLength(3);
  rerender(<EditMenu open anchor={anchor} items={[...items, { label: "Select All" }, { label: "Look Up" }, { label: "Share" }]} />);
  expect(screen.getByRole("menuitem", { name: "More items" })).toBeTruthy();
});

test("sits in the top layer where the browser has popovers", () => {
  const showPopover = vi.fn(function (this: HTMLElement) {});
  const hidePopover = vi.fn();
  Object.assign(HTMLElement.prototype, { showPopover, hidePopover });
  try {
    const { unmount } = render(<EditMenu open anchor={anchor} items={items} />);
    // The mock never opens it, so as far as jsdom is concerned it's still out of sight.
    expect(document.querySelector(".lg-edit-menu")!.getAttribute("popover")).toBe("manual");
    expect(showPopover).toHaveBeenCalledOnce();
    unmount();
  } finally {
    delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
    delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
  }
});
