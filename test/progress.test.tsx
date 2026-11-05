import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { Progress, Spinner } from "../src";

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
