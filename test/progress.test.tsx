import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Progress, Spinner } from "../src";
import { rule } from "./rule";

test("reports how far along it is, kept between 0 and 1", () => {
  const { rerender } = render(<Progress aria-label="Upload" value={0.25} />);
  expect(screen.getByRole("progressbar", { name: "Upload" }).getAttribute("aria-valuenow")).toBe("0.25");
  rerender(<Progress aria-label="Upload" value={3} />);
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
});

test("a spinner has eight blades and says it's loading", () => {
  render(<Spinner />);
  expect(screen.getByRole("status", { name: "Loading" }).querySelectorAll("i")).toHaveLength(8);
});

test("a spinner comes in iOS's three sizes, regular unless asked", () => {
  render(
    <>
      <Spinner aria-label="Regular" />
      <Spinner aria-label="Small" size="small" />
      <Spinner aria-label="Large" size="large" />
    </>,
  );
  expect(screen.getByRole("status", { name: "Regular" }).dataset.size).toBe("regular");
  expect(screen.getByRole("status", { name: "Small" }).dataset.size).toBe("small");
  expect(screen.getByRole("status", { name: "Large" }).dataset.size).toBe("large");
});

test("a spinner's blades are iOS 27's: 14, 20 and 37 points across, lit one at a time", () => {
  render(<Spinner />);
  const regular = rule("progress", ".lg-spinner");
  expect(regular).toContain("--lg-spinner-size: 20px");
  expect(regular).toContain("--lg-blade-length: 6.67px");
  expect(regular).toContain("color: var(--lg-spinner)");
  expect(rule("progress", '.lg-spinner[data-size="small"]')).toContain("--lg-spinner-size: 14px");
  const large = rule("progress", '.lg-spinner[data-size="large"]');
  expect(large).toContain("--lg-spinner-size: 37px");
  expect(large).toContain("--lg-blade-width: 5px");
  expect(large).toContain("--lg-blade-length: 12.33px");
  // Each blade turns about the spinner's centre, whatever its size.
  expect(rule("progress", ".lg-spinner > i")).toContain(
    "transform-origin: 50% calc(var(--lg-spinner-size) / 2 - var(--lg-blade-inset))",
  );
  // The four blades behind the lit one fade to a third, and the rest stay there.
  const css = document.querySelector('style[data-liquidglass="progress"]')!.textContent!;
  expect(css).toMatch(/@keyframes lg-spin\s*\{\s*from\s*\{\s*opacity: 1;\s*\}\s*50%,\s*to\s*\{\s*opacity: 0\.32;/);
  expect(rule("base", ":where(:root, [data-theme=\"light\"])")).toContain("--lg-spinner: rgb(60 60 67 / 0.51)");
});
