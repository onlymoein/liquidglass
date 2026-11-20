import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { expect, test } from "vitest";

import { ScrollEdge } from "../src";

// jsdom has no layout, so say how tall the content is and how much of it shows.
function measure(box: HTMLElement, content: number, shown: number) {
  Object.defineProperty(box, "scrollHeight", { configurable: true, value: content });
  Object.defineProperty(box, "clientHeight", { configurable: true, value: shown });
}

const area = (props: Parameters<typeof ScrollEdge>[0] = {}) => (
  <div data-testid="box" style={{ overflowY: "auto" }}>
    <p>Content</p>
    <ScrollEdge data-testid="band" {...props} />
  </div>
);

test("is decoration at the bottom, uniform and 100 points tall unless told otherwise, and forwards its ref", () => {
  const ref = createRef<HTMLDivElement>();
  render(<ScrollEdge ref={ref} data-testid="band" />);
  const band = screen.getByTestId("band");
  expect(ref.current).toBe(band);
  expect(band.className).toBe("lg-scroll-edge");
  expect(band.getAttribute("aria-hidden")).toBe("true");
  expect(band.dataset.side).toBe("bottom");
  expect(band.dataset.edge).toBe("uniform");
  expect(band.style.getPropertyValue("--lg-edge-size")).toBe("100px");
});

test("takes the side, the edge, the size and a class", () => {
  render(<ScrollEdge data-testid="band" side="top" edge="soft" size={64} className="mine" style={{ opacity: 0.5 }} />);
  const band = screen.getByTestId("band");
  expect(band.className).toBe("lg-scroll-edge mine");
  expect(band.dataset.side).toBe("top");
  expect(band.dataset.edge).toBe("soft");
  expect(band.style.getPropertyValue("--lg-edge-size")).toBe("64px");
  expect(band.style.opacity).toBe("0.5");
});

test("frosts the bottom while there is content below the edge, and not once the scroll runs out", () => {
  render(area());
  const box = screen.getByTestId("box");
  const band = screen.getByTestId("band");

  // The content is taller than the box, and the scroll is at the top.
  measure(box, 600, 300);
  box.scrollTop = 0;
  fireEvent.scroll(box);
  expect(band.hasAttribute("data-active")).toBe(true);

  box.scrollTop = 150;
  fireEvent.scroll(box);
  expect(band.hasAttribute("data-active")).toBe(true);

  // 300 + 300 = 600: nothing is left under the bar.
  box.scrollTop = 300;
  fireEvent.scroll(box);
  expect(band.hasAttribute("data-active")).toBe(false);

  box.scrollTop = 120;
  fireEvent.scroll(box);
  expect(band.hasAttribute("data-active")).toBe(true);
});

test("treats a fraction of a pixel left to scroll as none", () => {
  render(area());
  const box = screen.getByTestId("box");
  measure(box, 600, 300);
  box.scrollTop = 299.5;
  fireEvent.scroll(box);
  expect(screen.getByTestId("band").hasAttribute("data-active")).toBe(false);
});

test("is not there when everything fits", () => {
  render(area());
  const box = screen.getByTestId("box");
  measure(box, 300, 300);
  fireEvent.scroll(box);
  expect(screen.getByTestId("band").hasAttribute("data-active")).toBe(false);
});

test("at the top, frosts once content has scrolled under it, and stops at the top again", () => {
  render(area({ side: "top" }));
  const box = screen.getByTestId("box");
  const band = screen.getByTestId("band");
  measure(box, 600, 300);

  fireEvent.scroll(box);
  expect(band.hasAttribute("data-active")).toBe(false);

  box.scrollTop = 40;
  fireEvent.scroll(box);
  expect(band.hasAttribute("data-active")).toBe(true);

  box.scrollTop = 0;
  fireEvent.scroll(box);
  expect(band.hasAttribute("data-active")).toBe(false);
});

test("follows the page when nothing around it scrolls", () => {
  render(<ScrollEdge data-testid="band" />);
  const page = document.documentElement;
  Object.defineProperty(page, "scrollHeight", { configurable: true, value: 2000 });
  Object.defineProperty(page, "clientHeight", { configurable: true, value: 800 });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  fireEvent.scroll(window);
  expect(screen.getByTestId("band").hasAttribute("data-active")).toBe(true);

  Object.defineProperty(window, "scrollY", { configurable: true, value: 1200 });
  fireEvent.scroll(window);
  expect(screen.getByTestId("band").hasAttribute("data-active")).toBe(false);

  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  Reflect.deleteProperty(page, "scrollHeight");
  Reflect.deleteProperty(page, "clientHeight");
});

test("looks again when the content changes size without a scroll, as on a new tab", () => {
  const sizes: Array<() => void> = [];
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      sizes.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  try {
    render(area());
    const box = screen.getByTestId("box");
    const band = screen.getByTestId("band");
    measure(box, 300, 300);
    sizes.forEach((resized) => resized());
    expect(band.hasAttribute("data-active")).toBe(false);

    measure(box, 900, 300);
    sizes.forEach((resized) => resized());
    expect(band.hasAttribute("data-active")).toBe(true);
  } finally {
    globalThis.ResizeObserver = original;
  }
});

test("stops listening and leaves nothing behind when it unmounts", () => {
  const { unmount } = render(area());
  const box = screen.getByTestId("box");
  const band = screen.getByTestId("band");
  measure(box, 600, 300);
  fireEvent.scroll(box);
  expect(band.hasAttribute("data-active")).toBe(true);

  unmount();
  expect(band.hasAttribute("data-active")).toBe(false);
});
