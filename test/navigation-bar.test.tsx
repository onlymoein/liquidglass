import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, expect, test, vi } from "vitest";

import { Button, NavigationBar, ToolbarGroup } from "../src";

afterEach(() => vi.restoreAllMocks());

// jsdom has no layout, so say where the bar's bottom and the large title's bottom are.
function layout(bar: number, title: number) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const bottom = this.classList.contains("lg-nav-large") ? title : this.classList.contains("lg-nav") ? bar : 0;
    return { top: bottom, bottom, left: 0, right: 0, width: 0, height: 0, x: 0, y: bottom, toJSON() {} } as DOMRect;
  });
}

test("is a toolbar whose large title is the heading, and forwards its ref", () => {
  const ref = createRef<HTMLDivElement>();
  render(<NavigationBar ref={ref} title="Swatches" />);

  const bar = screen.getByRole("toolbar", { name: "Navigation bar" });
  expect(ref.current).toBe(bar);
  expect(bar.className).toContain("lg-nav");
  expect(bar.hasAttribute("data-large")).toBe(true);

  // The same words twice, but a screen reader hears them once.
  expect(screen.getAllByText("Swatches")).toHaveLength(2);
  expect(screen.getAllByRole("heading")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Swatches", level: 1 }).className).toBe("lg-nav-large");
  expect(bar.querySelector(".lg-nav-title")?.getAttribute("aria-hidden")).toBe("true");
});

test("without a large title, the bar's own is the heading, at the level asked for", () => {
  render(<NavigationBar title="Settings" large={false} level={2} aria-label="Settings bar" />);

  const bar = screen.getByRole("toolbar", { name: "Settings bar" });
  expect(bar.hasAttribute("data-large")).toBe(false);
  expect(screen.getAllByText("Settings")).toHaveLength(1);
  expect(screen.getByRole("heading", { name: "Settings", level: 2 }).className).toBe("lg-nav-title");
});

test("puts the back button first, and calls onBack when it's pressed", () => {
  const onBack = vi.fn();
  render(
    <NavigationBar
      title="Details"
      onBack={onBack}
      leading={<Button>Edit</Button>}
      trailing={<ToolbarGroup aria-label="Share"><Button>Share</Button></ToolbarGroup>}
    />,
  );

  const buttons = screen.getAllByRole("button").map((button) => button.textContent || button.getAttribute("aria-label"));
  expect(buttons).toEqual(["Back", "Edit", "Share"]);

  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("names the back button as asked, and leaves it out without onBack", () => {
  const { rerender } = render(<NavigationBar title="Details" onBack={() => {}} backLabel="Retour" />);
  expect(screen.getByRole("button", { name: "Retour" })).toBeTruthy();

  rerender(<NavigationBar title="Details" />);
  expect(screen.queryByRole("button")).toBeNull();
});

test("shows the bar's own title once the large one has scrolled under the bar", () => {
  const { container } = render(
    <div style={{ overflowY: "auto" }}>
      <NavigationBar title="Swatches" />
    </div>,
  );
  const box = container.firstElementChild as HTMLElement;
  const bar = screen.getByRole("toolbar");

  layout(60, 100);
  fireEvent.scroll(box);
  expect(bar.hasAttribute("data-collapsed")).toBe(false);

  layout(60, 70);
  fireEvent.scroll(box);
  expect(bar.hasAttribute("data-collapsed")).toBe(true);

  layout(60, 100);
  fireEvent.scroll(box);
  expect(bar.hasAttribute("data-collapsed")).toBe(false);
});

test("is already collapsed when it mounts with the large title under the bar", () => {
  layout(60, 20);
  render(
    <div style={{ overflowY: "auto" }}>
      <NavigationBar title="Swatches" />
    </div>,
  );
  expect(screen.getByRole("toolbar").hasAttribute("data-collapsed")).toBe(true);
});

test("still frosts its edge like a Toolbar, and takes the same edge prop", () => {
  const { container } = render(
    <div style={{ overflowY: "auto" }}>
      <NavigationBar title="Swatches" edge="soft" />
    </div>,
  );
  const box = container.firstElementChild as HTMLElement;
  const bar = screen.getByRole("toolbar");
  expect(bar.dataset.edge).toBe("soft");

  box.scrollTop = 30;
  fireEvent.scroll(box);
  expect(bar.hasAttribute("data-scrolled")).toBe(true);
});

test("stops listening when it unmounts", () => {
  const { container, unmount } = render(
    <div style={{ overflowY: "auto" }}>
      <NavigationBar title="Swatches" />
    </div>,
  );
  const box = container.firstElementChild as HTMLElement;
  const remove = vi.spyOn(box, "removeEventListener");
  unmount();
  expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
});
