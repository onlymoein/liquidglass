import { render } from "@testing-library/react";
import { expect, test } from "vitest";

import { Button, Slider } from "../src";
import { ORDER } from "../src/styles/order";

const parts = () => [...document.querySelectorAll("style[data-liquidglass]")].map((style) => style.getAttribute("data-liquidglass")!);

test("brings in only the styles of the components on the page", () => {
  render(<Button>Done</Button>);
  expect(parts()).toContain("base");
  expect(parts()).toContain("button");
  expect(parts()).not.toContain("menu");
  expect(parts()).not.toContain("sheet");
  expect(document.querySelector('style[data-liquidglass="button"]')!.textContent).toContain(".lg-button");
});

test("adds each part once, first in the head, in the stylesheet's order whichever comes first", () => {
  // The slider is drawn after the button, but its part comes before the menu's and after the
  // button's, as in the stylesheet.
  render(<Slider aria-label="Volume" />);
  render(<Button>Again</Button>);
  const names = parts();
  expect(new Set(names).size).toBe(names.length);
  expect(names).toEqual([...names].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)));
  // What accessibility settings override comes last, so it wins.
  expect(names.at(-1)).toBe("access");
  expect(document.head.firstElementChild!.getAttribute("data-liquidglass")).toBe("base");
});

test("an action sheet brings its own part and the shared fade, and not the alert's or the menu's", () => {
  render(<ActionSheet defaultOpen actions={[{ label: "Done" }]} aria-label="Choices" />);
  expect(parts()).toContain("action-sheet");
  expect(parts()).toContain("layer");
  expect(parts()).not.toContain("alert");
  expect(parts()).not.toContain("menu");
  // Its scrim and reduced-motion rules use lg-fade-in, so that must be in a part every page has.
  expect(document.querySelector('style[data-liquidglass="popup"]')!.textContent).toContain("@keyframes lg-fade-in");
});
