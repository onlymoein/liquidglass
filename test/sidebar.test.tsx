import { fireEvent, render, screen } from "@testing-library/react";
import { createRef, useState, type ComponentProps } from "react";
import { expect, test, vi } from "vitest";

import { Sidebar, type SidebarEntry } from "../src";

const entries: SidebarEntry[] = [
  { value: "inbox", label: "Inbox", badge: 3 },
  { value: "drafts", label: "Drafts" },
  { value: "sent", label: "Sent", disabled: true },
  { heading: "Folders", collapsible: true, items: [{ value: "travel", label: "Travel" }, { value: "work", label: "Work" }] },
  { heading: "Tags", items: [{ value: "red", label: "Red" }] },
];

const sidebar = (props: Partial<ComponentProps<typeof Sidebar>> = {}) => (
  <Sidebar aria-label="Mail" items={entries} {...props} />
);

test("is a navigation landmark of glass that forwards its ref", () => {
  const ref = createRef<HTMLElement>();
  render(sidebar({ ref }));
  const nav = screen.getByRole("navigation", { name: "Mail" });
  expect(ref.current).toBe(nav);
  expect(nav.className).toBe("lg-glass lg-sidebar");
});

test("groups loose rows into a section of their own and names sections by their headings", () => {
  render(sidebar());
  const lists = screen.getAllByRole("list");
  expect(lists).toHaveLength(3);
  expect(lists[0]!.hasAttribute("aria-labelledby")).toBe(false);
  expect(screen.getByRole("list", { name: "Folders" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "Tags" })).toBeTruthy();
  expect(screen.getByRole("button", { name: /^Inbox/ })).toBeTruthy();
});

test("marks the chosen row, and chooses one on a click", () => {
  const onValueChange = vi.fn();
  render(sidebar({ defaultValue: "inbox", onValueChange }));
  const inbox = screen.getByRole("button", { name: /^Inbox/ });
  const drafts = screen.getByRole("button", { name: "Drafts" });
  expect(inbox.getAttribute("aria-current")).toBe("page");
  expect(drafts.hasAttribute("aria-current")).toBe(false);

  fireEvent.click(drafts);
  expect(onValueChange).toHaveBeenCalledWith("drafts");
  expect(drafts.getAttribute("aria-current")).toBe("page");
  expect(inbox.hasAttribute("aria-current")).toBe(false);
});

test("leaves the choice to its owner when controlled", () => {
  const onValueChange = vi.fn();
  render(sidebar({ value: "inbox", onValueChange }));
  fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
  expect(onValueChange).toHaveBeenCalledWith("drafts");
  expect(screen.getByRole("button", { name: /^Inbox/ }).getAttribute("aria-current")).toBe("page");
});

test("doesn't choose a disabled row", () => {
  const onValueChange = vi.fn();
  render(sidebar({ onValueChange }));
  const sent = screen.getByRole("button", { name: "Sent" }) as HTMLButtonElement;
  expect(sent.disabled).toBe(true);
  fireEvent.click(sent);
  expect(onValueChange).not.toHaveBeenCalled();
});

test("renders rows with a safe href as links and tracks the choice", () => {
  const onValueChange = vi.fn();
  render(
    <Sidebar
      aria-label="Site"
      onValueChange={onValueChange}
      items={[
        { value: "home", label: "Home", href: "/" },
        { value: "docs", label: "Docs", href: "/docs" },
      ]}
    />,
  );
  const docs = screen.getByRole("link", { name: "Docs" });
  expect(docs.getAttribute("href")).toBe("/docs");
  docs.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(docs);
  expect(onValueChange).toHaveBeenCalledWith("docs");
  expect(docs.getAttribute("aria-current")).toBe("page");
});

test("leaves the choice alone when a link is opened in a new tab", () => {
  const onValueChange = vi.fn();
  render(<Sidebar aria-label="Site" onValueChange={onValueChange} items={[{ value: "docs", label: "Docs", href: "/docs" }]} />);
  const docs = screen.getByRole("link", { name: "Docs" });
  docs.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(docs, { metaKey: true });
  fireEvent.click(docs, { ctrlKey: true });
  expect(onValueChange).not.toHaveBeenCalled();
});

test("won't link to javascript: or data: URLs", () => {
  render(
    <Sidebar
      aria-label="Site"
      items={[
        { value: "xss", label: "Script", href: "javascript:alert(1)" },
        { value: "data", label: "Data", href: "data:text/html,<script>alert(1)</script>" },
      ]}
    />,
  );
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Script" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Data" })).toBeTruthy();
});

test("takes a component for its links", () => {
  const Router = ({ href, ...props }: ComponentProps<"a">) => <a data-router="" href={href} {...props} />;
  render(<Sidebar aria-label="Site" link={Router} items={[{ value: "docs", label: "Docs", href: "/docs" }]} />);
  expect(screen.getByRole("link", { name: "Docs" }).hasAttribute("data-router")).toBe(true);
});

test("folds a collapsible section away from its heading, and unfolds it", () => {
  render(sidebar());
  const heading = screen.getByRole("button", { name: "Folders" });
  const section = heading.closest(".lg-sidebar-section")!;
  expect(heading.getAttribute("aria-expanded")).toBe("true");
  expect(section.hasAttribute("data-folded")).toBe(false);

  fireEvent.click(heading);
  expect(heading.getAttribute("aria-expanded")).toBe("false");
  expect(section.hasAttribute("data-folded")).toBe(true);

  fireEvent.click(heading);
  expect(heading.getAttribute("aria-expanded")).toBe("true");
  expect(section.hasAttribute("data-folded")).toBe(false);
});

test("starts a section folded when asked to, and leaves plain headings as text", () => {
  render(
    <Sidebar
      aria-label="Mail"
      items={[
        { heading: "Folders", collapsible: true, defaultCollapsed: true, items: [{ value: "travel", label: "Travel" }] },
        { heading: "Tags", items: [{ value: "red", label: "Red" }] },
      ]}
    />,
  );
  expect(screen.getByRole("button", { name: "Folders" }).getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByRole("button", { name: "Tags" })).toBeNull();
  expect(screen.getByText("Tags").hasAttribute("data-static")).toBe(true);
});

test("moves between the rows with the arrow keys, skipping disabled rows and folded sections", () => {
  render(sidebar());
  const inbox = screen.getByRole("button", { name: /^Inbox/ });
  const drafts = screen.getByRole("button", { name: "Drafts" });
  const folders = screen.getByRole("button", { name: "Folders" });
  const travel = screen.getByRole("button", { name: "Travel" });
  const work = screen.getByRole("button", { name: "Work" });
  const red = screen.getByRole("button", { name: "Red" });

  inbox.focus();
  fireEvent.keyDown(inbox, { key: "ArrowDown" });
  expect(document.activeElement).toBe(drafts);
  fireEvent.keyDown(drafts, { key: "ArrowDown" });
  expect(document.activeElement).toBe(folders);
  fireEvent.keyDown(folders, { key: "ArrowDown" });
  expect(document.activeElement).toBe(travel);
  fireEvent.keyDown(travel, { key: "ArrowUp" });
  expect(document.activeElement).toBe(folders);

  fireEvent.click(folders);
  fireEvent.keyDown(folders, { key: "ArrowDown" });
  expect(document.activeElement).toBe(red);
  fireEvent.keyDown(red, { key: "Home" });
  expect(document.activeElement).toBe(inbox);
  fireEvent.keyDown(inbox, { key: "End" });
  expect(document.activeElement).toBe(red);
  expect(work).toBeTruthy();
});

test("slides away and can't be reached while it's closed", () => {
  const { rerender } = render(sidebar());
  const nav = screen.getByRole("navigation", { name: "Mail" });
  expect(nav.hasAttribute("inert")).toBe(false);
  expect(nav.hasAttribute("data-open")).toBe(false);

  rerender(sidebar({ open: false }));
  expect(nav.hasAttribute("inert")).toBe(true);
  expect(nav.getAttribute("data-open")).toBe("false");

  rerender(sidebar({ open: true }));
  expect(nav.hasAttribute("inert")).toBe(false);
});

test("shows a header and a footer around the rows", () => {
  render(sidebar({ header: <h2>Mail</h2>, footer: <button type="button">Account</button> }));
  const nav = screen.getByRole("navigation", { name: "Mail" });
  expect(nav.firstElementChild?.className).toBe("lg-sidebar-header");
  expect(nav.lastElementChild?.className).toBe("lg-sidebar-footer");
  expect(screen.getByRole("button", { name: "Account" })).toBeTruthy();
});

test("keeps its own choice between renders of its owner", () => {
  function Owner() {
    const [count, setCount] = useState(0);
    return (
      <>
        <button type="button" onClick={() => setCount(count + 1)}>
          Render {count}
        </button>
        {sidebar({ defaultValue: "inbox" })}
      </>
    );
  }
  render(<Owner />);
  fireEvent.click(screen.getByRole("button", { name: "Drafts" }));
  fireEvent.click(screen.getByRole("button", { name: "Render 0" }));
  expect(screen.getByRole("button", { name: "Drafts" }).getAttribute("aria-current")).toBe("page");
});
