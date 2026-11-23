import { expect, test } from "vitest";

import { upwardOrder, type EntryKind } from "../src/internal/menu-order";

// "-" is a divider, "#x" a heading, anything else a row.
const kind = (entry: string): EntryKind => (entry === "-" ? "separator" : entry.startsWith("#") ? "heading" : "row");
const order = (...entries: string[]) => upwardOrder(entries, kind);

test("lists the rows from the bottom", () => {
  expect(order("a", "b", "c")).toEqual(["c", "b", "a"]);
});

test("reverses the sections and the rows in each, with the divider between the same two", () => {
  expect(order("a", "b", "-", "c", "d", "e", "-", "f")).toEqual(["f", "-", "e", "d", "c", "-", "b", "a"]);
});

test("keeps a heading at the head of its own section", () => {
  expect(order("#Arrange", "a", "b", "-", "#Sort", "c", "d")).toEqual(["#Sort", "d", "c", "-", "#Arrange", "b", "a"]);
});

test("starts a section at a heading even with no divider before it", () => {
  expect(order("a", "b", "#Sort", "c", "d")).toEqual(["#Sort", "d", "c", "b", "a"]);
});

test("leaves a divider that opens, closes or doubles the list where it falls", () => {
  expect(order("-", "a", "b")).toEqual(["b", "a", "-"]);
  expect(order("a", "b", "-")).toEqual(["-", "b", "a"]);
  expect(order("a", "-", "-", "b")).toEqual(["b", "-", "-", "a"]);
});

test("copes with nothing to list, and does not change what it was given", () => {
  expect(order()).toEqual([]);
  const entries = ["a", "-", "b"];
  upwardOrder(entries, kind);
  expect(entries).toEqual(["a", "-", "b"]);
});
