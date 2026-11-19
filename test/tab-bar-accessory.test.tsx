import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Button, TabBarAccessory } from "../src";

test("is a labelled group of glass that holds what it's given", () => {
  render(
    <TabBarAccessory aria-label="Now playing">
      <span>Ember</span>
      <Button aria-label="Play" />
    </TabBarAccessory>,
  );
  const group = screen.getByRole("group", { name: "Now playing" });
  expect(group.classList.contains("lg-glass")).toBe(true);
  expect(group.classList.contains("lg-tab-accessory")).toBe(true);
  expect(group.textContent).toContain("Ember");
  expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
});

test("is above the tab bar unless it's placed inline", () => {
  const { rerender } = render(<TabBarAccessory aria-label="Now playing" />);
  const group = screen.getByRole("group", { name: "Now playing" });
  expect(group.hasAttribute("data-placement")).toBe(false);
  rerender(<TabBarAccessory aria-label="Now playing" placement="inline" />);
  expect(group.getAttribute("data-placement")).toBe("inline");
  rerender(<TabBarAccessory aria-label="Now playing" placement="above" />);
  expect(group.hasAttribute("data-placement")).toBe(false);
});

test("keeps its own class, props and ref", () => {
  let node: HTMLDivElement | null = null;
  render(<TabBarAccessory aria-label="Now playing" className="mine" data-testid="x" ref={(element) => void (node = element)} />);
  const group = screen.getByTestId("x");
  expect(group.classList.contains("mine")).toBe(true);
  expect(group.classList.contains("lg-tab-accessory")).toBe(true);
  expect(node).toBe(group);
});

test("brings in its styles, after the tab bar's", () => {
  render(<TabBarAccessory aria-label="Now playing" />);
  const names = [...document.querySelectorAll("style[data-liquidglass]")].map((style) => style.getAttribute("data-liquidglass")!);
  expect(names).toContain("tab-bar-accessory");
  expect(document.querySelector('style[data-liquidglass="tab-bar-accessory"]')!.textContent).toContain(".lg-tab-accessory");
});
