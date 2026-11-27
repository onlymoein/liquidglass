import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { expect, test } from "vitest";

import { Button } from "../src";

test("renders a labelled button", () => {
  render(<Button>Continue</Button>);
  const button = screen.getByRole("button", { name: "Continue" });
  expect(button.getAttribute("type")).toBe("button");
  expect(button.hasAttribute("data-icon")).toBe(false);
});

test("marks a button with only an icon", () => {
  render(<Button icon={<svg />} aria-label="Share" />);
  expect(screen.getByRole("button", { name: "Share" }).dataset.icon).toBe("only");
});

test("is a capsule unless asked to be a circle", () => {
  render(
    <>
      <Button>Capsule</Button>
      <Button shape="circle" icon={<svg />} aria-label="Add" />
    </>,
  );
  expect(screen.getByRole("button", { name: "Capsule" }).hasAttribute("data-shape")).toBe(false);
  expect(screen.getByRole("button", { name: "Add" }).dataset.shape).toBe("circle");
});

// One rule's declarations, by its exact selector, from the stylesheet the button brings in.
const rule = (selector: string) => {
  render(<Button>Styles</Button>);
  const css = document.querySelector('style[data-liquidglass="button"]')!.textContent!;
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|[}\\s])${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  expect(match, selector).not.toBeNull();
  return match![1];
};

test("has iOS 27's measured heights: 30, 36.33 and 52.33 with a label", () => {
  expect(rule(".lg-button")).toContain("height: 36.33px");
  expect(rule(".lg-button")).toContain("border-radius: 18.17px");
  expect(rule('.lg-button[data-size="small"]')).toContain("height: 30px");
  expect(rule('.lg-button[data-size="large"]')).toContain("height: 52.33px");
});

test("sits in a smaller, wider-than-tall capsule with only an icon", () => {
  const size = (selector: string, width: string, height: string) => {
    expect(rule(selector)).toContain(`width: ${width}`);
    expect(rule(selector)).toContain(`height: ${height}`);
  };
  size('.lg-button[data-icon="only"]', "42px", "30.67px");
  size('.lg-button[data-icon="only"][data-size="small"]', "36.33px", "25px");
  size('.lg-button[data-icon="only"][data-size="large"]', "58px", "46.67px");
});

test("is as wide as it's tall as a circle", () => {
  expect(rule('.lg-button[data-shape="circle"]')).toContain("width: 36.33px");
  expect(rule('.lg-button[data-shape="circle"][data-size="small"]')).toContain("width: 30px");
  expect(rule('.lg-button[data-shape="circle"][data-size="large"]')).toContain("width: 52.33px");
  expect(rule('.lg-button[data-shape="circle"][data-icon="only"]')).toContain("width: 30.67px");
  expect(rule('.lg-button[data-shape="circle"][data-icon="only"][data-size="small"]')).toContain("width: 25px");
  expect(rule('.lg-button[data-shape="circle"][data-icon="only"][data-size="large"]')).toContain("width: 46.67px");
});

test("narrows only the icon side of a button with an icon and a label", () => {
  expect(rule('.lg-button[data-icon=""]')).toContain("padding-left: 10.5px");
  // An icon-only button keeps its icon centred: no icon-side padding reaches it.
  expect(rule('.lg-button[data-icon="only"]')).toContain("padding: 0");
  expect(rule(".lg-button > svg")).toContain("width: calc(20em / 17)");
});

test("forwards its ref and props", () => {
  const ref = createRef<HTMLButtonElement>();
  render(<Button ref={ref} className="extra" disabled>Save</Button>);
  expect(ref.current).toBe(screen.getByRole("button"));
  expect(ref.current?.className).toBe("lg-glass lg-button extra");
  expect(ref.current?.disabled).toBe(true);
});

test("marks its variant and destructive role", () => {
  render(
    <>
      <Button>Glass</Button>
      <Button variant="filled" destructive>Delete</Button>
    </>,
  );
  const glass = screen.getByRole("button", { name: "Glass" });
  const remove = screen.getByRole("button", { name: "Delete" });
  expect(glass.hasAttribute("data-variant")).toBe(false);
  expect(glass.hasAttribute("data-destructive")).toBe(false);
  expect(remove.dataset.variant).toBe("filled");
  expect(remove.dataset.destructive).toBe("");
});

test("takes a custom tint", () => {
  render(<Button variant="filled" tint="#ff8d28">Order</Button>);
  const button = screen.getByRole("button", { name: "Order" });
  expect(button.hasAttribute("data-tint")).toBe(true);
  expect(button.style.getPropertyValue("--lg-tint")).toBe("#ff8d28");
});

test("takes the iOS control sizes, regular by default", () => {
  render(<Button>Regular</Button>);
  render(<Button size="large">Large</Button>);
  expect(screen.getByRole("button", { name: "Regular" }).hasAttribute("data-size")).toBe(false);
  expect(screen.getByRole("button", { name: "Large" }).dataset.size).toBe("large");
});
