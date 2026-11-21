import { useEffect, useId, useLayoutEffect, useRef, type JSX, type ReactNode } from "react";

import { cx } from "./internal/cx";
import { safeHref } from "./internal/href";
import { fitLens, rimAt } from "./internal/refraction";
import { createSpring } from "./internal/spring";
import type { MenuEntry, MenuItem } from "./menu";

export const isItem = (entry: MenuEntry | undefined): entry is MenuItem =>
  entry != null && entry !== "separator" && !("heading" in entry);

/** The entry at a path of indexes, through the submenus on the way. */
export function entryAt(entries: MenuEntry[], path: number[]): MenuEntry | undefined {
  let list: MenuEntry[] | undefined = entries;
  let found: MenuEntry | undefined;
  for (const index of path) {
    found = list?.[index];
    list = isItem(found) ? found.items : undefined;
  }
  return found;
}

const checkmark = (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" aria-hidden>
    <path d="m2.75 7.25 2.75 2.75 5.75-6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// iOS draws a submenu's row with a chevron after it, and turns it to point down on the card
// that row opens into.
const more = (
  <svg className="lg-menu-more" viewBox="0 0 12 12" fill="none" stroke="currentColor" aria-hidden>
    <path d="m4 2 4 4-4 4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** What a menu or a submenu holds, as rows. `opened` names the submenus open now, by path. */
export function renderEntries(entries: MenuEntry[], base: number[], opened: readonly string[]): ReactNode[] {
  return entries.map((entry, index) => {
    if (entry === "separator") return <div key={index} role="separator" className="lg-menu-separator" />;
    if ("heading" in entry) {
      return (
        <div key={index} role="presentation" className="lg-menu-heading">
          {entry.heading}
        </div>
      );
    }
    const path = [...base, index];
    const submenu = Array.isArray(entry.items);
    // A submenu has no choice, link or action of its own: it opens.
    const choice = !submenu && entry.checked !== undefined;
    const props = {
      role: choice ? "menuitemradio" : "menuitem",
      "aria-checked": choice ? entry.checked : undefined,
      "aria-haspopup": submenu ? ("menu" as const) : undefined,
      "aria-expanded": submenu ? opened.includes(path.join(".")) : undefined,
      className: cx("lg-menu-item", entry.className),
      "data-index": index,
      "data-path": path.join("."),
      "data-submenu": submenu ? "" : undefined,
      "data-destructive": entry.destructive ? "" : undefined,
    };
    const body = (
      <>
        {choice ? (
          <span className="lg-menu-check" aria-hidden>
            {entry.checked ? checkmark : null}
          </span>
        ) : null}
        {entry.icon}
        {entry.label}
        {submenu ? more : null}
      </>
    );
    const href = submenu ? undefined : safeHref(entry.href);
    return href && !entry.disabled ? (
      <a key={index} href={href} {...props}>
        {body}
      </a>
    ) : (
      <button key={index} type="button" disabled={entry.disabled} {...props}>
        {body}
      </button>
    );
  });
}

// iOS's own, read from a recording of a submenu opening in the iOS 27 simulator: the card
// comes up with its top 15 points above the row that opened it (or, when the menu opens
// upward, with its bottom 12 points above the menu's), the menu behind it shrinks to 97%
// and dims, and the row's chevron turns to point down.
const LIFT = 15;
const TUCK = 12;
const SHRINK = 0.03;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export interface SubmenuProps {
  /** The item that opens it. */
  item: MenuItem;
  /** Where that item is, as indexes through the menu and its submenus. */
  path: number[];
  /** Whether it's open; false while it folds back into its row. */
  open: boolean;
  /** Whether a key opened it, which puts focus on its first item. */
  keyboard: boolean;
  /** The paths of the submenus open now. */
  opened: readonly string[];
  /** Called once it has folded away. */
  onGone: () => void;
}

/**
 * A submenu: a card of glass that grows out of the row that opened it and stacks over the
 * menu, as on iOS. The row becomes its title, with its chevron turned down; choosing the title
 * folds the card back into the row.
 */
export function Submenu({ item, path, open, keyboard, opened, onGone }: SubmenuProps): JSX.Element {
  const id = useId();
  const subRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const control = useRef<{ set(target: number): void } | null>(null);
  const gone = useRef(onGone);
  const opening = useRef(open);

  useEffect(() => {
    gone.current = onGone;
  });

  useLayoutEffect(() => {
    const sub = subRef.current!;
    const surface = surfaceRef.current!;
    const content = contentRef.current!;
    const card = sub.closest<HTMLElement>(".lg-menu-card")!;
    const row = card.querySelector<HTMLElement>(`.lg-menu-item:not(.lg-menu-sub-head)[data-path="${path.join(".")}"]`);
    // The card, or the submenu, whose row this is: what the new card is stacked over.
    const behind = row?.closest<HTMLElement>(".lg-menu-sub") ?? card;
    const layers = [...behind.children].filter(
      (child): child is HTMLElement => child.classList.contains("lg-menu-surface") || child.classList.contains("lg-menu-content"),
    );
    const parentContent = layers.find((layer) => layer.classList.contains("lg-menu-content"));

    // Placed at its own size, over the row, and kept on the screen.
    const edge = 8;
    const view = { width: document.documentElement.clientWidth || window.innerWidth, height: window.innerHeight };
    const cardBox = card.getBoundingClientRect();
    const behindBox = behind.getBoundingClientRect();
    const rowBox = row?.getBoundingClientRect() ?? behindBox;
    const room = view.height - edge * 2;
    if (sub.offsetHeight > room) {
      sub.dataset.scrolls = "";
      content.style.maxHeight = `${room}px`;
    }
    const width = sub.offsetWidth;
    const height = Math.min(sub.offsetHeight, room);
    const upward = card.dataset.side === "top";
    let top = rowBox.top - cardBox.top - LIFT;
    if (upward) top = Math.min(top, behindBox.bottom - cardBox.top - TUCK - height);
    top = Math.max(edge - cardBox.top, Math.min(top, view.height - edge - height - cardBox.top));
    const left = Math.max(edge - cardBox.left, Math.min(0, view.width - edge - width - cardBox.left));
    sub.style.left = `${left}px`;
    sub.style.top = `${top}px`;

    // The card starts as the row, and ends as itself.
    const from = { x: rowBox.left - cardBox.left - left, y: rowBox.top - cardBox.top - top, width: rowBox.width, height: rowBox.height };
    const radius = Math.min(parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 33, width / 2, height / 2);
    const start = Math.min(from.height / 2, radius);
    // Where the card behind it shrinks to: toward the edge the menu grew from.
    behind.style.setProperty("--lg-recede-dy", `${((upward ? 1 : -1) * behindBox.height * SHRINK) / 2}px`);
    parentContent?.toggleAttribute("inert", true);
    // Whichever submenu opened last has the say over how what it covers looks.
    behind.dataset.receder = id;

    let stopLens: (() => void) | undefined;
    // Worked out once, for where it's going.
    const stopRim = rimAt(surface, width, height, radius);

    const paint = (p: number) => {
      const x = from.x * (1 - p);
      const y = from.y * (1 - p);
      const w = from.width + (width - from.width) * p;
      const h = from.height + (height - from.height) * p;
      const corner = Math.max(0, Math.min(start + (radius - start) * p, w / 2, h / 2));
      surface.style.left = `${x}px`;
      surface.style.top = `${y}px`;
      surface.style.width = `${w}px`;
      surface.style.height = `${h}px`;
      surface.style.borderRadius = `${corner}px`;
      // The glass is only there once it's more than the row, which has its own label to show.
      surface.style.opacity = String(clamp(p / 0.25));
      // The items come into focus as the card opens past them.
      const items = clamp((p - 0.2) / 0.55);
      content.style.opacity = String(items);
      content.style.filter = items < 1 ? `blur(${3 * (1 - items)}px)` : "";
      content.style.clipPath = `inset(${y}px ${width - x - w}px ${height - y - h}px ${x}px round ${corner}px)`;
      sub.style.setProperty("--lg-turn", String(clamp(p)));
      if (behind.dataset.receder === id) behind.style.setProperty("--lg-recede", String(clamp(p)));
    };

    const settle = () => {
      for (const name of ["left", "top", "width", "height", "borderRadius", "opacity"] as const) surface.style[name] = "";
      for (const name of ["opacity", "filter", "clipPath"] as const) content.style[name] = "";
      delete sub.dataset.morphing;
      stopLens ??= fitLens(surface);
    };

    let goal = -1;
    // Spring values are 0 for the row, 1 for the open card. Critically damped, so it never
    // swings past either, and about 0.4 seconds to settle, as iOS's does.
    const spring = createSpring(0, 300, 35, (p) => {
      paint(p);
      if (p === goal && goal === 1) settle();
      if (p === goal && goal === 0) gone.current();
    });
    control.current = {
      set(target) {
        if (target === goal) return;
        goal = target;
        stopLens?.();
        stopLens = undefined;
        sub.dataset.morphing = "";
        spring.set(target);
      },
    };

    sub.dataset.morphing = "";
    paint(0);
    // A finger has no use for a ringed row, and a key needs one to start from.
    if (keyboard) {
      const rows = [...sub.querySelectorAll<HTMLElement>(".lg-menu-item:not(:disabled)")];
      (rows[1] ?? rows[0])?.focus({ preventScroll: true });
    } else {
      sub.focus({ preventScroll: true });
    }
    control.current.set(opening.current ? 1 : 0);

    return () => {
      spring.stop();
      stopLens?.();
      stopRim();
      control.current = null;
      if (behind.dataset.receder !== id) return;
      parentContent?.removeAttribute("inert");
      behind.style.removeProperty("--lg-recede");
      behind.style.removeProperty("--lg-recede-dy");
      delete behind.dataset.receder;
    };
    // It's placed once, when it's mounted; its own props only say whether it's open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    opening.current = open;
    const sub = subRef.current;
    if (!control.current || !sub) return;
    if (open) return control.current.set(1);
    // Folding back: what it covered works again, and focus goes with it.
    const card = sub.closest<HTMLElement>(".lg-menu-card");
    const row = card?.querySelector<HTMLElement>(`.lg-menu-item:not(.lg-menu-sub-head)[data-path="${path.join(".")}"]`);
    const behind = row?.closest<HTMLElement>(".lg-menu-sub") ?? card;
    if (behind?.dataset.receder === id) {
      [...behind.children].find((child) => child.classList.contains("lg-menu-content"))?.removeAttribute("inert");
    }
    if (sub.contains(document.activeElement)) (keyboard ? row : card)?.focus({ preventScroll: true });
    control.current.set(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      ref={subRef}
      role="menu"
      aria-labelledby={id}
      tabIndex={-1}
      className="lg-menu-sub"
      data-sub={path.join(".")}
      data-leaving={open ? undefined : ""}
    >
      <span ref={surfaceRef} className="lg-glass lg-menu-surface" data-size-fixed aria-hidden />
      <div ref={contentRef} role="none" className="lg-menu-content">
        <span className="lg-menu-plate" aria-hidden />
        <button
          id={id}
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={open}
          className="lg-menu-item lg-menu-sub-head"
          data-path={path.join(".")}
          data-submenu=""
        >
          {item.label}
          {more}
        </button>
        <div role="separator" className="lg-menu-separator" />
        {renderEntries(item.items ?? [], path, opened)}
      </div>
    </div>
  );
}
