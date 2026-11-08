import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { expect, test } from "vitest";

import { Button, Toolbar, ToolbarGroup } from "../src";

const bar = (edge?: "uniform" | "soft" | "none") => (
  <Toolbar aria-label="Editor" edge={edge}>
    <ToolbarGroup aria-label="History">
      <Button>Undo</Button>
      <Button disabled>Redo</Button>
    </ToolbarGroup>
    <ToolbarGroup aria-label="Share">
      <Button>Share</Button>
    </ToolbarGroup>
  </Toolbar>
);

test("groups its actions on glass and forwards its ref", () => {
  const ref = createRef<HTMLDivElement>();
  render(<Toolbar ref={ref} aria-label="Editor" />);
  expect(ref.current).toBe(screen.getByRole("toolbar", { name: "Editor" }));
  expect(ref.current?.dataset.edge).toBe("uniform");

  render(bar());
  expect(screen.getByRole("group", { name: "History" }).className).toBe("lg-glass lg-toolbar-group");
});

test("moves between its actions with the arrow keys, skipping disabled ones", () => {
  render(bar());
  const undo = screen.getByRole("button", { name: "Undo" });
  const share = screen.getByRole("button", { name: "Share" });

  undo.focus();
  fireEvent.keyDown(undo, { key: "ArrowRight" });
  expect(document.activeElement).toBe(share);
  fireEvent.keyDown(share, { key: "ArrowRight" });
  expect(document.activeElement).toBe(undo);
  fireEvent.keyDown(undo, { key: "End" });
  expect(document.activeElement).toBe(share);
  fireEvent.keyDown(share, { key: "Home" });
  expect(document.activeElement).toBe(undo);
});

test("frosts its edge once content scrolls under it", () => {
  const { container } = render(<div style={{ overflowY: "auto" }}>{bar()}</div>);
  const box = container.firstElementChild as HTMLElement;
  const toolbar = screen.getByRole("toolbar");
  expect(toolbar.hasAttribute("data-scrolled")).toBe(false);

  box.scrollTop = 40;
  fireEvent.scroll(box);
  expect(toolbar.hasAttribute("data-scrolled")).toBe(true);

  box.scrollTop = 0;
  fireEvent.scroll(box);
  expect(toolbar.hasAttribute("data-scrolled")).toBe(false);
});

test("leaves its edge alone when asked to", () => {
  const { container } = render(<div style={{ overflowY: "auto" }}>{bar("none")}</div>);
  const box = container.firstElementChild as HTMLElement;
  box.scrollTop = 40;
  fireEvent.scroll(box);
  const toolbar = screen.getByRole("toolbar");
  expect(toolbar.hasAttribute("data-scrolled")).toBe(false);
  expect(toolbar.hasAttribute("data-edge")).toBe(false);
});

test("pressing a button in a group grows and lights the group's glass, as iOS does", () => {
  render(bar());
  const undo = screen.getByRole("button", { name: "Undo" });
  const group = screen.getByRole("group", { name: "History" });
  fireEvent.pointerDown(undo, { pointerId: 1, isPrimary: true, button: 0, pointerType: "touch", clientX: 10, clientY: 10 });
  expect(group.hasAttribute("data-pressed")).toBe(true);
  expect(undo.style.scale).toBe("");
  fireEvent.pointerUp(window, { pointerId: 1 });
  expect(group.hasAttribute("data-pressed")).toBe(false);
});

test("a filled button in a group keeps its own glass when pressed", () => {
  render(
    <Toolbar aria-label="Editor">
      <ToolbarGroup aria-label="Save">
        <Button variant="filled">Save</Button>
      </ToolbarGroup>
    </Toolbar>,
  );
  const save = screen.getByRole("button", { name: "Save" });
  fireEvent.pointerDown(save, { pointerId: 1, isPrimary: true, button: 0, pointerType: "touch", clientX: 10, clientY: 10 });
  expect(screen.getByRole("group", { name: "Save" }).hasAttribute("data-pressed")).toBe(false);
  expect(save.hasAttribute("data-pressed")).toBe(true);
  fireEvent.pointerUp(window, { pointerId: 1 });
});
