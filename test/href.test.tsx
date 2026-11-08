import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { Menu } from "../src";
import { safeHref } from "../src/internal/href";

test("allows relative and web links and refuses script ones", () => {
  for (const ok of ["/ship?mode=1", "../x", "#top", "https://a.test/b", "HTTP://a.test", "mailto:a@b.c", "tel:+90"]) {
    expect(safeHref(ok)).toBe(ok);
  }
  for (const bad of ["javascript:alert(1)", " JaVa\tScRiPt:alert(1)", "java\nscript:alert(1)", "data:text/html,x", "vbscript:x", "blob:x", "file:///etc"]) {
    expect(safeHref(bad)).toBeUndefined();
  }
});

test("a menu item with a javascript link is not a link and is never followed", () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  render(<Menu aria-label="Options" items={[{ label: "Bad", href: "javascript:alert(1)" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Options" }));
  const row = screen.getByText("Bad").closest(".lg-menu-item")!;
  expect(row.tagName).toBe("BUTTON");
  fireEvent.click(row, { metaKey: true });
  expect(open).not.toHaveBeenCalled();
  open.mockRestore();
});
