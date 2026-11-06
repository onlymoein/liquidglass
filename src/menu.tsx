import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";

import { Button, type ButtonProps } from "./button";
import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { placeMenu, type Placement } from "./internal/placement";
import { fitLens, rimAt } from "./internal/refraction";
import { createSpring, prefersReducedMotion } from "./internal/spring";

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  /**
   * Makes the item a link. Choosing it calls `onSelect` if there is one, such as a router's
   * navigate, and follows the link if not; with ⌘, Ctrl, Shift or the middle button it opens
   * a new tab.
   */
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  /**
   * Makes the item one of a set of choices, such as a sort order or an appearance, with a
   * checkmark beside the one that's chosen.
   */
  checked?: boolean;
  /** Choosing the item leaves the menu open, so what it changed can be seen, as for a setting. */
  keepOpen?: boolean;
  className?: string;
}

/** A line of small text above the items it introduces, such as the title of a section. */
export interface MenuHeading {
  heading: ReactNode;
}

export type MenuEntry = MenuItem | MenuHeading | "separator";

export interface MenuProps {
  items: MenuEntry[];
  /** Names the menu for assistive technology, and the trigger too when it has no `label`. */
  "aria-label": string;
  /** The trigger's icon. Defaults to an ellipsis when there's no `label`. */
  icon?: ReactNode;
  /** Turns the trigger into a pill with this label, like an iOS pull-down button. */
  label?: ReactNode;
  /** Adds a chevron after a `label`. iOS doesn't draw one on a glass pull-down, so it's off by default. */
  chevron?: boolean;
  /** Anything else for the trigger button, such as its `variant` or `className`. */
  trigger?: Omit<ButtonProps, "icon" | "children" | "onClick">;
  /** The trigger edge the menu lines up with as it opens across it. */
  align?: "start" | "center" | "end";
  /** Whether the menu is open. Pass it with `onOpenChange` to open and close the menu yourself. */
  open?: boolean;
  defaultOpen?: boolean;
  /** Called when the trigger, Escape, Tab, a chosen item or a press outside asks to open or close the menu. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

type Phase = "closed" | "open" | "leaving";

// The menu is measured and placed before it's first painted.
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

const modifiers = ({ metaKey, ctrlKey, shiftKey }: MouseEvent | PointerEvent) => ({ metaKey, ctrlKey, shiftKey });
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const resistance = (value: number) => Math.sign(value) * 7 * (1 - Math.exp((-Math.abs(value) * 0.12) / 7));
const isItem = (entry: MenuEntry | undefined): entry is MenuItem =>
  entry != null && entry !== "separator" && !("heading" in entry);

// The glass's shape as it opens and closes, one row a frame at 60fps, read from iOS 27.
// Width, height and centre are how far along from the trigger (0) to the menu (1). The
// width goes well below 0: the pill squeezes into a ball as it drops, and the ball swells
// into the menu. Then how much the items are zoomed, and how round the corners are, from
// as round as the shape allows (1) to the menu's own (0).
type Row = readonly [width: number, height: number, centre: number, zoom: number, round: number];
const OPENING: readonly Row[] = [
  [0, 0, 0, 0.7, 1],
  [-0.43, 0, 0.01, 0.7, 1],
  [-1.28, 0.04, 0.15, 0.7, 1],
  [-1.48, 0.435, 0.73, 0.75, 1],
  [-1.22, 0.53, 0.88, 0.85, 1],
  [-0.97, 0.6, 1, 0.95, 1],
  [-0.52, 0.73, 1.2, 1.08, 1],
  [-0.14, 0.81, 1.33, 1.19, 1],
  [0.21, 0.88, 1.4, 1.25, 0.92],
  [0.45, 0.91, 1.4, 1.27, 0.83],
  [0.66, 0.95, 1.365, 1.28, 0.75],
  [0.8, 0.97, 1.31, 1.25, 0.66],
  [0.93, 0.99, 1.25, 1.2, 0.58],
  [1.03, 1.01, 1.2, 1.16, 0.49],
  [1.07, 1.02, 1.14, 1.12, 0.41],
  [1.1, 1.02, 1.087, 1.09, 0.32],
  [1.1, 1.02, 1.052, 1.06, 0.24],
  [1.1, 1.02, 1.035, 1.04, 0.15],
  [1.07, 1.02, 1.017, 1.03, 0.1],
  [1.07, 1.02, 1, 1.02, 0.05],
  [1.07, 1.01, 0.99, 1.01, 0.02],
  [1.03, 1.01, 0.99, 1, 0],
  [1.02, 1.01, 0.99, 1, 0],
  [1.01, 1, 0.99, 1, 0],
  [1, 1, 1, 1, 0],
];
const CLOSING: readonly Row[] = [
  [1, 1, 1, 1, 0],
  [0.86, 0.98, 1.226, 1, 0.2],
  [0.64, 0.94, 1.41, 0.98, 0.5],
  [0.33, 0.9, 1.44, 0.95, 0.75],
  [-0.02, 0.86, 1.365, 0.92, 1],
  [-0.38, 0.81, 1.21, 0.9, 1],
  [-0.72, 0.74, 1.02, 0.88, 1],
  [-1.05, 0.66, 0.82, 0.86, 1],
  [-1.34, 0.57, 0.63, 0.84, 1],
  [-1.59, 0.49, 0.47, 0.82, 1],
];
// The drop's width, as a share of the trigger's, and how far it hangs below it, as a share
// of the menu's height. Then the trigger's width, and its lift in points, as it comes back.
const DROPLET: readonly (readonly [number, number, number, number])[] = [
  [0.41, 0.35, 0.61, -3],
  [0.35, 0.25, 0.69, -5],
  [0.31, 0.165, 0.76, -6],
  [0.28, 0.096, 0.81, -7],
  [0.23, 0.035, 0.865, -7],
  [0.18, 0, 0.9, -6],
  [0, 0, 0.93, -6],
  [0, 0, 0.96, -5],
  [0, 0, 0.98, -5],
  [0, 0, 0.99, -4],
  [0, 0, 1, -4],
  [0, 0, 1.01, -3],
  [0, 0, 1.016, -2],
  [0, 0, 1.02, -2],
  [0, 0, 1.02, -1],
  [0, 0, 1.016, -1],
  [0, 0, 1.016, -1],
  [0, 0, 1.01, 0],
  [0, 0, 1.008, 0],
  [0, 0, 1.004, 0],
  [0, 0, 1, 0],
];

function tableRow(table: readonly Row[], at: number): Row {
  const lower = table[Math.min(Math.floor(at), table.length - 1)]!;
  const upper = table[Math.min(Math.floor(at) + 1, table.length - 1)]!;
  const part = at - Math.floor(at);
  return lower.map((value, i) => value + (upper[i]! - value) * part) as unknown as Row;
}

// The row whose height is closest, so one motion can take over from the other part-way.
function nearest(table: readonly Row[], height: number): number {
  let best = 0;
  table.forEach((row, i) => {
    if (Math.abs(row[1] - height) < Math.abs(table[best]![1] - height)) best = i;
  });
  return best;
}

const chevronIcon = (
  <svg className="lg-menu-chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" aria-hidden>
    <path d="M2.5 4.5 6 8l3.5-3.5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ellipsis = (
  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <circle cx="3" cy="8" r="1.4" />
    <circle cx="8" cy="8" r="1.4" />
    <circle cx="13" cy="8" r="1.4" />
  </svg>
);

const checkmark = (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" aria-hidden>
    <path d="m2.75 7.25 2.75 2.75 5.75-6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Where the trigger stands, without the scale its press spring may still be writing on it.
function triggerRect(trigger: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const width = trigger.offsetWidth;
  const height = trigger.offsetHeight;
  return {
    left: rect.left + rect.width / 2 - width / 2,
    top: rect.top + rect.height / 2 - height / 2,
    width,
    height,
  };
}

const viewport = () => ({
  width: document.documentElement.clientWidth || window.innerWidth,
  height: window.innerHeight,
});

// In the top layer, the menu is above everything on the page, and nothing that scrolls or
// clips around its trigger can cut it off.
// The attribute goes on only where the browser has popovers: elsewhere it can hide the menu.
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

export function Menu({
  items,
  "aria-label": name,
  icon: iconProp,
  label,
  trigger,
  align = "center",
  chevron = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  style,
}: MenuProps): JSX.Element {
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const icon = iconProp ?? (label == null ? ellipsis : undefined);
  const face =
    label == null ? (
      icon
    ) : (
      <>
        {icon}
        {label}
        {chevron ? chevronIcon : null}
      </>
    );
  // `open` is whether the menu should be open; the phase follows it, and keeps
  // the menu mounted while its glass runs back into the trigger.
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLSpanElement>(null);
  const glyphRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLSpanElement>(null);
  const morphRef = useRef<{ set(target: number): void } | null>(null);
  const latest = useRef({ items, open, setOpen });
  const refocus = useRef(true);
  const tapped = useRef(0);
  const mounted = phase !== "closed";

  useEffect(() => {
    latest.current = { items, open, setOpen };
  });

  useEffect(() => {
    if (open) return setPhase("open");
    setPhase((current) => (current === "closed" ? current : "leaving"));
    // Focus left inside the menu would be lost as it unmounts.
    if (refocus.current && cardRef.current?.contains(document.activeElement)) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    refocus.current = true;
  }, [open]);

  useEffect(() => {
    if (phase === "open") morphRef.current?.set(1);
    if (phase === "leaving") morphRef.current?.set(0);
  }, [phase]);

  useLayout(() => {
    if (!mounted) return;
    const trigger = triggerRef.current!;
    const card = cardRef.current!;
    const surface = surfaceRef.current!;
    const glyph = glyphRef.current!;
    const content = contentRef.current!;
    const plate = plateRef.current!;

    // Measured at its own size first, then placed over the trigger.
    show(card);
    card.style.left = "0px";
    card.style.top = "0px";
    card.style.setProperty("--lg-menu-min-width", `${trigger.offsetWidth}px`);
    const start = triggerRect(trigger);
    const place: Placement = placeMenu(
      start,
      { width: card.offsetWidth, height: card.offsetHeight },
      card.dataset.align as "start" | "center" | "end",
      viewport(),
    );
    card.dataset.side = place.side;
    if (place.scrolls) {
      card.dataset.scrolls = "";
      content.style.maxHeight = `${place.height}px`;
    }
    card.style.left = `${place.left}px`;
    card.style.top = `${place.top}px`;

    // As on iOS, the glass grows out of the trigger while the items scale up
    // from its centre and come into focus. Closing runs it back.
    const from = { x: start.left - place.left, y: start.top - place.top, width: start.width, height: start.height };
    const to = { width: card.offsetWidth, height: card.offsetHeight };
    const radius = Math.min(parseFloat(getComputedStyle(surface).borderTopLeftRadius) || 0, to.width / 2, to.height / 2);
    const roundest = Math.min(1, radius / (Math.min(to.width, to.height) / 2));
    const centre = { x: to.width / 2, y: to.height / 2 };
    const home = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    content.style.transformOrigin = `${centre.x}px ${centre.y}px`;
    card.style.transformOrigin = `${home.x}px ${home.y}px`;
    glyph.style.left = `${from.x}px`;
    glyph.style.top = `${from.y}px`;
    glyph.style.width = `${from.width}px`;
    glyph.style.height = `${from.height}px`;
    // The face keeps the trigger's ink, such as white on a filled one, and its
    // layout, so its label lands exactly on the trigger's.
    const ink = getComputedStyle(trigger);
    glyph.style.color = ink.color;
    glyph.style.padding = `0 ${ink.paddingRight} 0 ${ink.paddingLeft}`;
    glyph.style.gap = ink.columnGap;
    glyph.style.fontSize = ink.fontSize;
    let stopLens: (() => void) | undefined;
    // Worked out once, for where it's going.
    const stopRim = rimAt(surface, to.width, to.height, radius);

    // The measured sizes are for a 192 x 52 trigger and a 250 x 167 menu. Past either
    // end of the range they're kept as a share of the size they run from.
    const wide = (n: number) =>
      Math.max(from.height * 0.8, n < 0 ? from.width * (1 + 0.302 * n) : n > 1 ? to.width * (1 + 0.232 * (n - 1)) : from.width + (to.width - from.width) * n);
    const tall = (n: number) => (n > 1 ? to.height * (1 + 0.69 * (n - 1)) : from.height + (to.height - from.height) * n);

    // The glass as a blob at one row of a table, with the items inside it.
    const blob = ([w, h, c, zoom, round]: Row, items: number, soft: number, face: number) => {
      const width = wide(w);
      const height = tall(h);
      const x = home.x + (centre.x - home.x) * clamp(w) - width / 2;
      const cy = home.y + (centre.y - home.y) * c;
      const y = cy - height / 2;
      const corner = ((roundest + (1 - roundest) * round) * Math.min(width, height)) / 2;
      surface.style.left = `${x}px`;
      surface.style.top = `${y}px`;
      surface.style.width = `${width}px`;
      surface.style.height = `${height}px`;
      surface.style.borderRadius = `${corner}px`;
      surface.style.opacity = "1";
      glyph.style.opacity = String(face);
      glyph.style.filter = `blur(${4 * (1 - face)}px)`;
      // The items ride lower than the glass, and swell as they go through its middle.
      const shift = (cy - centre.y) * 0.45;
      const local = (edge: number, middle: number, by = 0) => middle + (edge - middle - by) / zoom;
      content.style.opacity = String(items);
      content.style.transform = `translateY(${shift}px) scale(${zoom})`;
      content.style.filter = soft ? `blur(${soft}px)` : "";
      content.style.clipPath = `inset(${local(y, centre.y, shift)}px ${to.width - local(x + width, centre.x)}px ${to.height - local(y + height, centre.y, shift)}px ${local(x, centre.x)}px round ${corner / zoom}px)`;
    };

    // The last of closing: the trigger is back, and what's left of the glass runs into it as a drop.
    const drop = ([size, reach, sx, dy]: readonly [number, number, number, number]) => {
      content.style.opacity = "0";
      glyph.style.opacity = "0";
      trigger.style.opacity = "";
      trigger.style.transform = `translateY(${dy}px) scaleX(${sx})`;
      const bottom = from.y + from.height + dy;
      const height = reach * (to.height - from.height);
      const width = size * from.width;
      surface.style.opacity = size && height > 0 ? "1" : "0";
      surface.style.left = `${home.x - width / 2}px`;
      surface.style.top = `${bottom}px`;
      surface.style.width = `${width}px`;
      surface.style.height = `${Math.max(0, height)}px`;
      surface.style.borderRadius = `0 0 ${width / 2}px ${width / 2}px`;
    };

    const rest = () => {
      for (const name of ["left", "top", "width", "height", "borderRadius", "opacity"] as const) surface.style[name] = "";
      for (const name of ["opacity", "transform", "filter", "clipPath"] as const) content.style[name] = "";
      glyph.style.opacity = "0";
      delete card.dataset.morphing;
    };

    let goal = -1;
    let at = 0;
    let frame = 0;
    let last = 0;
    let row: Row = OPENING[0]!;
    const shapeNow = () => {
      if (goal === 1) {
        if (at >= OPENING.length - 1) {
          rest();
          stopLens ??= fitLens(surface);
          return true;
        }
        row = tableRow(OPENING, at);
        trigger.style.opacity = "0";
        blob(row, clamp((at - 1) / 6), 5 * clamp(1 - (at - 2) / 14), clamp(1 - at / 2.5));
        return false;
      }
      if (at < CLOSING.length) {
        row = tableRow(CLOSING, at);
        trigger.style.opacity = "0";
        blob(row, clamp(1 - at / 4), 4 * clamp(at / 4), clamp((at - 5) / 3));
        return false;
      }
      const index = at - CLOSING.length;
      if (index >= DROPLET.length - 1) {
        trigger.style.opacity = "";
        trigger.style.transform = "";
        setPhase("closed");
        return true;
      }
      const lower = DROPLET[Math.floor(index)]!;
      const upper = DROPLET[Math.floor(index) + 1]!;
      const part = index - Math.floor(index);
      drop(lower.map((value, i) => value + (upper[i]! - value) * part) as unknown as readonly [number, number, number, number]);
      return false;
    };
    // Glass takes a moment to reach the screen when it's first shown.
    let warming = 3;
    const step = (time: number) => {
      frame = 0;
      if (warming > 0) {
        warming--;
        last = time;
        frame = requestAnimationFrame(step);
        return;
      }
      // A stalled frame shouldn't skip the shape.
      at += (Math.min(34, Math.max(0, time - last)) * 60) / 1000;
      last = time;
      if (!shapeNow()) frame = requestAnimationFrame(step);
    };
    const morph = {
      set(target: number) {
        if (target === goal) return;
        const interrupted = goal !== -1;
        goal = target;
        stopLens?.();
        stopLens = undefined;
        card.dataset.morphing = "";
        const table = target === 1 ? OPENING : CLOSING;
        // Taken up mid-way, it carries on from the row nearest where it is.
        at = interrupted && (target === 0 || at < CLOSING.length) ? nearest(table, row[1]) : 0;
        cancelAnimationFrame(frame);
        if (document.hidden || prefersReducedMotion()) {
          at = table === OPENING ? OPENING.length : CLOSING.length + DROPLET.length;
          shapeNow();
          return;
        }
        last = Number(document.timeline?.currentTime ?? performance.now());
        shapeNow();
        frame = requestAnimationFrame(step);
      },
    };
    morphRef.current = morph;
    morph.set(1);
    // A row its own className hides, say for one kind of screen, is passed over.
    const rows = () =>
      [...card.querySelectorAll<HTMLElement>(".lg-menu-item:not(:disabled)")].filter(
        (row) => getComputedStyle(row).display !== "none",
      );
    // A keyboard starts on the first row. A finger has no use for it, and it'd come up ringed.
    if (tapped.current) card.focus({ preventScroll: true });
    else rows()[0]?.focus({ preventScroll: true });

    // The menu stays over its trigger as the page scrolls or the window changes size.
    const follow = (event: Event) => {
      if (event.target instanceof Node && card.contains(event.target)) return;
      const now = triggerRect(trigger);
      const next = placeMenu(
        now,
        { width: card.offsetWidth, height: card.offsetHeight },
        card.dataset.align as "start" | "center" | "end",
        viewport(),
      );
      card.style.left = `${next.left}px`;
      card.style.top = `${place.side === "bottom" ? now.top : now.top + now.height - card.offsetHeight}px`;
    };

    const offset = { scale: 1, x: 0, y: 0 };
    const paint = () => {
      card.style.scale = String(offset.scale);
      card.style.translate = `${offset.x}px ${offset.y}px`;
    };
    const scale = createSpring(1, 650, 36, (value) => {
      offset.scale = value;
      paint();
    });
    const x = createSpring(0, 600, 30, (value) => {
      offset.x = value;
      paint();
    });
    const y = createSpring(0, 600, 30, (value) => {
      offset.y = value;
      paint();
    });

    let gesture: { id: number; x: number; y: number } | null = null;
    let current: HTMLElement | null = null;
    let suppressClickUntil = 0;

    // Asks to close. A controlled menu stays open until its owner agrees.
    const close = (restoreFocus = true) => {
      if (!latest.current.open) return;
      refocus.current = restoreFocus;
      latest.current.setOpen(false);
    };

    // The plate slides between rows for a drag and for a hovering mouse alike.
    const highlight = (row: HTMLElement | null) => {
      if (current === row) return;
      const first = !current;
      current = row;
      if (!row) {
        delete card.dataset.scrubbing;
        plate.style.opacity = "0";
        return;
      }
      card.dataset.scrubbing = "";
      plate.style.width = `${row.offsetWidth}px`;
      plate.style.height = `${row.offsetHeight}px`;
      // The first row lights up in place and at once, taking over from the
      // row's own hover background without a gap; later rows slide to it.
      if (first) plate.style.transition = "none";
      plate.style.transform = `translate(${row.offsetLeft}px, ${row.offsetTop}px)`;
      plate.style.opacity = "1";
      if (first) {
        void plate.offsetWidth;
        plate.style.transition = "";
      }
    };

    const rowAt = (clientX: number, clientY: number) => {
      const row = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>(".lg-menu-item");
      return row && !row.matches(":disabled") && card.contains(row) ? row : null;
    };

    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
      // A menu that scrolls leaves a finger free to scroll it.
      if (!(event.pointerType === "touch" && place.scrolls)) card.setPointerCapture(event.pointerId);
      card.dataset.pressed = "";
      scale.set(1 + 5 / Math.max(card.offsetWidth, card.offsetHeight, 200));
      highlight(rowAt(event.clientX, event.clientY));
    };

    const move = (event: PointerEvent) => {
      if (!gesture) {
        // Crossing a separator keeps the plate on the last row, so it slides
        // across the gap to the next one instead of fading out and reappearing.
        const row = event.pointerType === "mouse" ? rowAt(event.clientX, event.clientY) : null;
        if (row) highlight(row);
        return;
      }
      if (event.pointerId !== gesture.id) return;
      highlight(rowAt(event.clientX, event.clientY));
      x.set(resistance(event.clientX - gesture.x), true);
      y.set(resistance(event.clientY - gesture.y), true);
    };

    const end = (event: PointerEvent) => {
      if (event.pointerId !== gesture?.id) return;
      const chosen = event.type === "pointerup" ? rowAt(event.clientX, event.clientY) : null;
      highlight(null);
      gesture = null;
      delete card.dataset.pressed;
      scale.set(1);
      x.set(0);
      y.set(0);
      suppressClickUntil = performance.now() + 500;
      // Carries the modifiers, so ⌘ on a link still means a new tab.
      chosen?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ...modifiers(event) }));
    };

    const leave = (event: PointerEvent) => {
      if (!gesture && event.pointerType === "mouse") highlight(null);
    };

    const click = (event: MouseEvent) => {
      const row = (event.target as Element).closest<HTMLElement>(".lg-menu-item");
      if (!row) return;
      // A link is followed here, once, rather than by the browser as well.
      if (row instanceof HTMLAnchorElement) event.preventDefault();
      if (event.detail !== 0 && performance.now() < suppressClickUntil) return;
      const item = latest.current.items[Number(row.dataset.index)];
      if (!isItem(item)) return;
      const elsewhere = Object.values(modifiers(event)).some(Boolean);
      if (!item.keepOpen || (item.href && elsewhere)) close();
      if (item.href && elsewhere) window.open(item.href, "_blank", "noopener");
      else if (item.onSelect) item.onSelect();
      else if (item.href) window.location.assign(item.href);
    };

    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // The menu takes the Escape, so a dialog it opened over stays open.
        event.preventDefault();
        event.stopPropagation();
        close();
      } else if (event.key === "Tab") {
        close(false);
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        if (!gesture) highlight(null);
        const list = rows();
        const index = list.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? list.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
        list[next]?.focus();
      }
    };

    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!card.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };

    card.addEventListener("pointerdown", down);
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", leave);
    card.addEventListener("pointerup", end);
    card.addEventListener("pointercancel", end);
    card.addEventListener("lostpointercapture", end);
    card.addEventListener("click", click);
    card.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      cancelAnimationFrame(frame);
      trigger.style.transform = "";
      [scale, x, y].forEach((spring) => spring.stop());
      stopLens?.();
      stopRim();
      morphRef.current = null;
      trigger.style.opacity = "";
      card.removeEventListener("pointerdown", down);
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
      card.removeEventListener("pointerup", end);
      card.removeEventListener("pointercancel", end);
      card.removeEventListener("lostpointercapture", end);
      card.removeEventListener("click", click);
      card.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      hide(card);
    };
  }, [mounted]);

  return (
    <div className={cx("lg-menu", className)} style={style}>
      <Button
        {...trigger}
        ref={triggerRef}
        icon={icon}
        aria-label={trigger?.["aria-label"] ?? (label == null ? name : undefined)}
        aria-haspopup="menu"
        aria-expanded={open}
        // A finger opens it as it lifts, as on iOS: the click comes a beat later.
        onPointerUp={(event) => {
          trigger?.onPointerUp?.(event);
          if (event.pointerType !== "touch" || trigger?.disabled) return;
          const box = event.currentTarget.getBoundingClientRect();
          const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
          if (!inside) return;
          tapped.current = event.timeStamp;
          setOpen(!open);
        }}
        onClick={(event) => {
          const fromTap = tapped.current && event.timeStamp - tapped.current < 700;
          tapped.current = 0;
          if (!fromTap) setOpen(!open);
        }}
      >
        {label == null ? null : (
          <>
            {label}
            {chevron ? chevronIcon : null}
          </>
        )}
      </Button>
      {mounted ? (
        <div
          ref={cardRef}
          role="menu"
          tabIndex={-1}
          aria-label={name}
          className="lg-menu-card"
          data-phase={phase}
          data-align={align}
          data-label={label == null ? undefined : ""}
        >
          <span ref={surfaceRef} className="lg-glass lg-menu-surface" data-size-fixed aria-hidden />
          <span ref={glyphRef} className="lg-menu-glyph" aria-hidden>
            {face}
          </span>
          <div ref={contentRef} role="none" className="lg-menu-content">
            <span ref={plateRef} className="lg-menu-plate" aria-hidden />
            {items.map((item, index) => {
              if (item === "separator") return <div key={index} role="separator" className="lg-menu-separator" />;
              if ("heading" in item) {
                return (
                  <div key={index} role="presentation" className="lg-menu-heading">
                    {item.heading}
                  </div>
                );
              }
              const choice = item.checked !== undefined;
              const props = {
                role: choice ? "menuitemradio" : "menuitem",
                "aria-checked": choice ? item.checked : undefined,
                className: cx("lg-menu-item", item.className),
                "data-index": index,
                "data-destructive": item.destructive ? "" : undefined,
              };
              const body = (
                <>
                  {choice ? (
                    <span className="lg-menu-check" aria-hidden>
                      {item.checked ? checkmark : null}
                    </span>
                  ) : null}
                  {item.icon}
                  {item.label}
                </>
              );
              return item.href && !item.disabled ? (
                <a key={index} href={item.href} {...props}>
                  {body}
                </a>
              ) : (
                <button key={index} type="button" disabled={item.disabled} {...props}>
                  {body}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
