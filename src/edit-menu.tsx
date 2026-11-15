import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { EDIT_EDGE, paginate, placeEditMenu, type EditRect } from "./internal/edit-placement";
import { reducedMotion } from "./internal/modal";
import { fitLens, fitRim } from "./internal/refraction";
import { useStyles } from "./internal/styles";
import editMenuCss from "./styles/edit-menu.css?inline";

export interface EditMenuItem {
  /** What the item says: Cut, Copy, Paste, Select All. */
  label: ReactNode;
  /** Runs when the item is pressed, and the menu goes away. */
  onSelect?: () => void;
  disabled?: boolean;
  /** For an item whose label alone isn't enough, such as an icon. */
  "aria-label"?: string;
}

/**
 * What the menu points at, in the window's coordinates: a rectangle (a pressed point is a
 * rectangle with no size), or anything that can say where it is, such as the `Range` of a
 * selection or an element. It's read again as the page scrolls, so a `Range` is followed.
 */
export type EditMenuAnchor = EditRect | { getBoundingClientRect(): EditRect };

export interface EditMenuProps {
  /** The items, in order. Those that don't fit in the window's width go on further pages. */
  items: EditMenuItem[];
  /** What it points at, usually the selection. Nothing is shown without one. */
  anchor: EditMenuAnchor | null;
  /** Names the menu for assistive technology. Default "Edit". */
  "aria-label"?: string;
  /** Whether the menu is open. Pass it with `onOpenChange` to open and close it yourself. */
  open?: boolean;
  defaultOpen?: boolean;
  /** Called when Escape, a press outside, or choosing an item asks to close the menu. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

type Phase = "closed" | "open" | "leaving";

/** How long the menu takes to leave, before it's taken off the page. */
const LEAVE_MS = 140;

/** How long it takes to come in, after which the glass can bend what's behind it. */
const SETTLE_MS = 260;

/** The width of the chevron that turns the page. Matches `.lg-edit-more` in the stylesheet. */
const CHEVRON = 40;

// The menu is measured and placed before it's first painted.
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

const viewport = () => ({
  width: document.documentElement.clientWidth || window.innerWidth,
  height: window.innerHeight,
});

const rectOf = (anchor: EditMenuAnchor): EditRect => ("getBoundingClientRect" in anchor ? anchor.getBoundingClientRect() : anchor);

// In the top layer, the menu is above everything on the page, and nothing that scrolls or
// clips around the text can cut it off. The attribute goes on only where the browser has
// popovers: elsewhere it can hide the menu.
function show(card: HTMLElement) {
  if (!("showPopover" in card) || card.matches(":popover-open")) return;
  card.setAttribute("popover", "manual");
  try {
    card.showPopover();
  } catch {
    // Fixed positioning alone still places it.
  }
}

function hide(card: HTMLElement) {
  if (!("hidePopover" in card) || !card.matches(":popover-open")) return;
  try {
    card.hidePopover();
  } catch {
    // Unmounting takes it out of the top layer anyway.
  }
}

const chevron = (
  <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 1.5 8.5 6 4 10.5" />
  </svg>
);

/**
 * The iOS edit menu: a capsule of glass above a selection, with Cut, Copy, Paste and the like.
 * It isn't modal and never takes focus or the selection from the text it acts on. Items that
 * don't fit the window's width go on pages, turned with a chevron at either end. Escape or a
 * press outside closes it.
 */
export function EditMenu({
  items,
  anchor,
  "aria-label": name = "Edit",
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  style,
}: EditMenuProps): JSX.Element | null {
  useStyles(["edit-menu", editMenuCss]);
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  // Which items are on which page. Nothing until they've been measured, which takes every item in the card at once.
  const [pages, setPages] = useState<number[][] | null>(null);
  const [page, setPage] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLSpanElement>(null);
  const latest = useRef({ open, setOpen, anchor });
  const measuredAt = useRef(0);
  const turned = useRef<1 | -1 | 0>(0);
  const bend = useRef<((after: number) => void) | null>(null);
  const replace = useRef<(() => void) | null>(null);
  const mounted = phase !== "closed" && anchor !== null;

  // Before the layout effects below, which read it as they place the menu.
  useLayout(() => {
    latest.current = { open, setOpen, anchor };
  });

  useEffect(() => {
    if (open) return setPhase("open");
    setPhase((current) => (current === "closed" ? current : "leaving"));
  }, [open]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setPhase("closed"), reducedMotion() ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // What the items say, so they're measured again when it changes. Their elements can't tell.
  const sign = items.map((item) => (typeof item.label === "string" || typeof item.label === "number" ? item.label : "·")).join("\n");
  useLayout(() => {
    setPages(null);
    setPage(0);
  }, [sign]);

  // In the top layer, kept beside what it points at as the page moves.
  useLayout(() => {
    if (!mounted) return;
    const card = cardRef.current!;
    const surface = surfaceRef.current!;
    show(card);

    const stopRim = fitRim(surface);
    let stopLens: (() => void) | undefined;
    let settle: ReturnType<typeof setTimeout> | undefined;
    bend.current = (after) => {
      stopLens?.();
      stopLens = undefined;
      clearTimeout(settle);
      settle = setTimeout(() => {
        stopLens = fitLens(surface);
      }, after);
    };
    bend.current(reducedMotion() ? 0 : SETTLE_MS);

    const follow = (event?: Event) => {
      if (event?.target instanceof Node && card.contains(event.target)) return;
      replace.current?.();
    };

    // Asks to close. A controlled menu stays open until its owner agrees.
    const close = () => {
      if (latest.current.open) latest.current.setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const outside = (event: PointerEvent) => {
      if (!card.contains(event.target as Node)) close();
    };

    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      clearTimeout(settle);
      stopLens?.();
      stopRim();
      bend.current = null;
      replace.current = null;
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      hide(card);
      // Open again, it starts over on the first page.
      setPages(null);
      setPage(0);
    };
  }, [mounted]);

  // Measures the items, then places the menu beside what it points at, again whenever the page
  // turns, because each page is its own width.
  useLayout(() => {
    if (!mounted) return;
    const card = cardRef.current!;
    const row = card.querySelector<HTMLElement>(".lg-edit-row")!;
    const room = viewport().width - EDIT_EDGE * 2;

    if (pages === null) {
      measuredAt.current = room;
      const widths = [...row.querySelectorAll<HTMLElement>("[data-item]")].map((item) => item.offsetWidth);
      setPages(paginate(widths, room, CHEVRON));
      return;
    }

    const place = () => {
      const target = latest.current.anchor;
      if (!target) return;
      // A window of another width has other pages.
      if (viewport().width - EDIT_EDGE * 2 !== measuredAt.current) return setPages(null);
      card.style.left = "0px";
      card.style.top = "0px";
      const size = { width: card.offsetWidth, height: card.offsetHeight };
      const at = placeEditMenu(rectOf(target), size, viewport());
      card.dataset.side = at.side;
      if (at.hidden) card.dataset.hidden = "";
      else delete card.dataset.hidden;
      card.style.left = `${at.left}px`;
      card.style.top = `${at.top}px`;
      // It opens out of the point it's aimed at, on the edge nearest to it.
      card.style.transformOrigin = `${at.origin}px ${at.side === "top" ? "100%" : "0"}`;
      card.dataset.placed = "";
      return size;
    };
    const before = { width: card.offsetWidth, height: card.offsetHeight };
    const size = place();
    replace.current = () => void place();
    if (size && (size.width !== before.width || size.height !== before.height)) bend.current?.(150);

    // A page turned with a chevron: focus moves to the chevron that's still there, so a
    // keyboard can go on, rather than being lost with the one that went.
    if (turned.current !== 0) {
      const wanted = turned.current === 1 ? "next" : "back";
      const other = wanted === "next" ? "back" : "next";
      (card.querySelector<HTMLElement>(`[data-more="${wanted}"]`) ?? card.querySelector<HTMLElement>(`[data-more="${other}"]`))?.focus({ preventScroll: true });
      turned.current = 0;
    }
  }, [mounted, pages, page, sign]);

  // The anchor is another one: the menu goes to it.
  useLayout(() => {
    replace.current?.();
  }, [anchor]);

  if (!mounted) return null;

  const shown = pages === null ? items.map((_, index) => index) : (pages[Math.min(page, pages.length - 1)] ?? []);
  const last = pages === null ? 0 : pages.length - 1;
  const turn = (by: 1 | -1) => {
    turned.current = by;
    setPage((now) => Math.max(0, Math.min(last, now + by)));
  };

  // Left and right go from one control to the next, as in any menu that runs sideways.
  const keys = (event: ReactKeyboardEvent<HTMLElement>) => {
    const keyed = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[event.key];
    if (keyed === undefined) return;
    const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled)")];
    const at = controls.indexOf(document.activeElement as HTMLElement);
    const next = controls[Math.max(0, Math.min(controls.length - 1, Number.isFinite(keyed) ? at + keyed : keyed < 0 ? 0 : controls.length - 1))];
    if (!next) return;
    event.preventDefault();
    next.focus({ preventScroll: true });
  };

  return (
    <div
      ref={cardRef}
      role="menu"
      aria-label={name}
      aria-orientation="horizontal"
      className={cx("lg-edit-menu", className)}
      style={style}
      data-phase={phase}
      data-measuring={pages === null ? "" : undefined}
      onKeyDown={keys}
      // Pressing it must not take the focus, and with it the selection, from the text.
      onMouseDown={(event) => event.preventDefault()}
    >
      <span ref={surfaceRef} className="lg-glass lg-edit-menu-surface" aria-hidden />
      <div className="lg-edit-row" key={page}>
        {pages !== null && page > 0 ? (
          <button type="button" role="menuitem" className="lg-edit-more" data-more="back" aria-label="Previous items" onClick={() => turn(-1)}>
            {chevron}
          </button>
        ) : null}
        {shown.map((index) => {
          const item = items[index]!;
          return (
            <button
              key={index}
              type="button"
              role="menuitem"
              className="lg-edit-item"
              data-item=""
              disabled={item.disabled}
              aria-label={item["aria-label"]}
              onClick={() => {
                item.onSelect?.();
                latest.current.setOpen(false);
              }}
            >
              {item.label}
            </button>
          );
        })}
        {pages !== null && page < last ? (
          <button type="button" role="menuitem" className="lg-edit-more" data-more="next" aria-label="More items" onClick={() => turn(1)}>
            {chevron}
          </button>
        ) : null}
      </div>
    </div>
  );
}
