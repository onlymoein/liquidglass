import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, test, vi } from "vitest";

import { TabBarSearch } from "../src";

const icon = <svg viewBox="0 0 24 24" aria-hidden />;
const items = [
  { value: "songs", label: "Songs", icon },
  { value: "radio", label: "Radio", icon },
];

const field = () => screen.getByPlaceholderText("Search") as HTMLInputElement;
// Found by its class, as it is hidden once the field is open and has no accessible name then.
const circle = () => document.querySelector<HTMLButtonElement>(".lg-tab-search-trigger")!;
const root = () => document.querySelector<HTMLElement>(".lg-tab-search")!;

test("starts as the tabs and a search circle, with the field only a glyph", () => {
  render(<TabBarSearch items={items} defaultValue="songs" />);
  expect(screen.getByRole("tablist", { name: "Tabs" })).toBeTruthy();
  expect(root().hasAttribute("data-searching")).toBe(false);
  expect(screen.getByRole("button", { name: "Search" }).getAttribute("aria-expanded")).toBe("false");
  // The circle is what's pressed and tabbed to: the field behind it is out of both.
  expect(field().readOnly).toBe(true);
  expect(field().tabIndex).toBe(-1);
  expect(field().getAttribute("aria-hidden")).toBe("true");
  expect(document.querySelector(".lg-tab-bar")!.hasAttribute("data-minimized")).toBe(false);
});

test("tapping the circle opens the field with the focus, and shrinks the tabs to the current icon", () => {
  const onSearchingChange = vi.fn();
  render(<TabBarSearch items={items} defaultValue="radio" onSearchingChange={onSearchingChange} />);
  fireEvent.click(circle());
  expect(onSearchingChange).toHaveBeenCalledWith(true);
  expect(root().hasAttribute("data-searching")).toBe(true);
  expect(document.querySelector(".lg-tab-bar")!.hasAttribute("data-minimized")).toBe(true);
  expect(document.activeElement).toBe(field());
  expect(field().readOnly).toBe(false);
  expect(field().tabIndex).toBe(0);
  expect(field().hasAttribute("aria-hidden")).toBe(false);
  // Tapping the circle is no longer possible, nor is it announced.
  expect(circle().getAttribute("aria-hidden")).toBe("true");
  expect(circle().tabIndex).toBe(-1);
  // The tab it came from stays selected.
  expect(screen.getByRole("tab", { name: "Radio", hidden: true }).getAttribute("aria-selected")).toBe("true");
});

test("reports what is typed, and Enter", () => {
  const onQueryChange = vi.fn();
  const onSearch = vi.fn();
  render(<TabBarSearch items={items} defaultSearching onQueryChange={onQueryChange} onSearch={onSearch} />);
  fireEvent.change(field(), { target: { value: "plum" } });
  expect(onQueryChange).toHaveBeenCalledWith("plum");
  fireEvent.keyDown(field(), { key: "Enter" });
  expect(onSearch).toHaveBeenCalledWith("plum");
});

test("opening already searching does not take the focus", () => {
  render(<TabBarSearch items={items} defaultSearching />);
  expect(root().hasAttribute("data-searching")).toBe(true);
  expect(document.activeElement).not.toBe(field());
});

test("Escape closes the search, empties it and gives the focus to the circle", () => {
  const onQueryChange = vi.fn();
  render(<TabBarSearch items={items} defaultValue="songs" onQueryChange={onQueryChange} />);
  fireEvent.click(circle());
  fireEvent.change(field(), { target: { value: "plum" } });
  fireEvent.keyDown(field(), { key: "Escape" });
  expect(root().hasAttribute("data-searching")).toBe(false);
  expect(onQueryChange).toHaveBeenLastCalledWith("");
  expect(field().value).toBe("");
  expect(document.activeElement).toBe(circle());
  expect(document.querySelector(".lg-tab-bar")!.hasAttribute("data-minimized")).toBe(false);
});

test("the current tab's icon brings the tabs back", () => {
  render(<TabBarSearch items={items} defaultValue="songs" />);
  fireEvent.click(circle());
  fireEvent.click(screen.getByRole("button", { name: "Show tabs" }));
  expect(root().hasAttribute("data-searching")).toBe(false);
});

test("a controlled search only opens when told to", () => {
  const onSearchingChange = vi.fn();
  const { rerender } = render(<TabBarSearch items={items} searching={false} onSearchingChange={onSearchingChange} />);
  fireEvent.click(circle());
  expect(onSearchingChange).toHaveBeenCalledWith(true);
  expect(root().hasAttribute("data-searching")).toBe(false);
  rerender(<TabBarSearch items={items} searching onSearchingChange={onSearchingChange} />);
  expect(root().hasAttribute("data-searching")).toBe(true);
  expect(document.activeElement).toBe(field());
});

test("names the circle, the field and the tabs as asked", () => {
  render(<TabBarSearch items={items} searchLabel="Find music" placeholder="Artists, songs" tabsLabel="Library" />);
  expect(screen.getByRole("button", { name: "Find music" })).toBeTruthy();
  expect(screen.getByPlaceholderText("Artists, songs").getAttribute("aria-label")).toBe("Artists, songs");
  expect(screen.getByRole("tablist", { name: "Library" })).toBeTruthy();
});

test("keeps the width the tabs have at rest, so that they can shrink and grow back", () => {
  const offset = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(189);
  render(<TabBarSearch items={items} />);
  expect(root().style.getPropertyValue("--lg-tabs-width")).toBe("189px");
  offset.mockRestore();
});

test("switches tabs while closed", () => {
  const onValueChange = vi.fn();
  function Host() {
    const [value, setValue] = useState<string | null>("songs");
    return <TabBarSearch items={items} value={value} onValueChange={(next) => { setValue(next); onValueChange(next); }} />;
  }
  render(<Host />);
  act(() => {
    fireEvent.click(screen.getByRole("tab", { name: "Radio" }));
  });
  expect(onValueChange).toHaveBeenCalledWith("radio");
});

test("shrinks the tabs when asked, leaves the circle, and gives the tabs back on a tap of the icon", () => {
  const onExpand = vi.fn();
  render(<TabBarSearch items={items} defaultValue="songs" minimized onExpand={onExpand} />);
  expect(root().hasAttribute("data-minimized")).toBe(true);
  expect(root().hasAttribute("data-searching")).toBe(false);
  expect(document.querySelector(".lg-tab-bar")!.hasAttribute("data-minimized")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Show tabs" }));
  expect(onExpand).toHaveBeenCalledTimes(1);
  // The circle still opens the search.
  fireEvent.click(circle());
  expect(root().hasAttribute("data-searching")).toBe(true);
  expect(root().hasAttribute("data-minimized")).toBe(false);
});
