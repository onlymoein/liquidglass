import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";

import { Button, type ButtonProps } from "./button";
import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { placeMenu, type Placement } from "./internal/placement";
import { createSpring, type Spring } from "./internal/spring";

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
  /** Turns the trigger into a pill with this label and a chevron, like an iOS pull-down button. */
  label?: ReactNode;
  /** Whether a labelled trigger shows its chevron. Defaults to `true`. */
  chevron?: boolean;
  /** Anything else for the trigger button, such as its `variant` or `className`. */
  trigger?: Omit<ButtonProps, "icon" | "children" | "onClick">;
  /** The trigger edge the menu lines up with as it opens across it. */
  align?: "start" | "end";
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
  chevron = true,
  trigger,
  align = "end",
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
  const morphRef = useRef<Spring | null>(null);
  const latest = useRef({ items, open, setOpen });
  const refocus = useRef(true);
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
      card.dataset.align === "start" ? "start" : "end",
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
    const radius = parseFloat(getComputedStyle(surface).borderTopLeftRadius);
    // A lone icon swells as it goes; a label grows less, so it doesn't sprawl.
    const swell = card.hasAttribute("data-label") ? 0.15 : 0.6;
    const origin = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
    content.style.transformOrigin = `${origin.x}px ${origin.y}px`;
    card.style.transformOrigin = `${origin.x}px ${origin.y}px`;
    glyph.style.left = `${from.x}px`;
    glyph.style.top = `${from.y}px`;
    glyph.style.width = `${from.width}px`;
    glyph.style.height = `${from.height}px`;
    // The face keeps the trigger's ink, such as white on a filled one, as it goes.
    glyph.style.color = getComputedStyle(trigger).color;
    let leaving = false;
    const shape = createSpring(0, 600, 46, (value) => {
      const t = clamp(value);
      const settled = t === 1;
      // The glass's rect, from the trigger's to the menu's.
      const x = from.x * (1 - t);
      const y = from.y * (1 - t);
      const width = from.width + (to.width - from.width) * t;
      const height = from.height + (to.height - from.height) * t;
      const scale = 0.5 + 0.5 * t;
      // The items stay inside the glass: clip them to its rect, mapped back
      // through their own scale.
      const local = (edge: number, centre: number) => centre + (edge - centre) / scale;
      const left = local(x, origin.x);
      const right = local(x + width, origin.x);
      const top = local(y, origin.y);
      const bottom = local(y + height, origin.y);
      surface.style.left = settled ? "" : `${x}px`;
      surface.style.top = settled ? "" : `${y}px`;
      surface.style.width = settled ? "" : `${width}px`;
      surface.style.height = settled ? "" : `${height}px`;
      surface.style.opacity = String(clamp(t / 0.2));
      trigger.style.opacity = t === 0 ? "" : String(1 - clamp(t / 0.2));
      // The trigger's icon rides the glass towards its centre, swelling and
      // blurring away as the items arrive.
      const drift = 0.3 * t;
      const dx = (x + width / 2 - origin.x) * drift;
      const dy = (y + height / 2 - origin.y) * drift;
      glyph.style.opacity = String(1 - clamp(t / 0.45));
      glyph.style.transform = `translate(${dx}px, ${dy}px) scale(${1 + swell * t})`;
      glyph.style.filter = `blur(${8 * t}px)`;
      content.style.opacity = String(leaving ? clamp((t - 0.55) / 0.45) : clamp((t - 0.15) / 0.6));
      content.style.transform = settled ? "" : `scale(${scale})`;
      content.style.filter = settled ? "" : `blur(${6 * (1 - t)}px)`;
      content.style.clipPath = settled
        ? ""
        : `inset(${top}px ${to.width - right}px ${to.height - bottom}px ${left}px round ${radius / scale}px)`;
      if (leaving && value === 0) setPhase("closed");
    });
    const morph: Spring = {
      ...shape,
      set(target, instant) {
        leaving = target === 0;
        if (leaving) shape.tune(900, 57);
        else shape.tune(600, 46);
        shape.set(target, instant);
      },
    };
    morphRef.current = morph;
    shape.paint();
    morph.set(1);
    // A row its own className hides, say for one kind of screen, is passed over.
    const rows = () =>
      [...card.querySelectorAll<HTMLElement>(".lg-menu-item:not(:disabled)")].filter(
        (row) => getComputedStyle(row).display !== "none",
      );
    rows()[0]?.focus({ preventScroll: true });

    // The menu stays over its trigger as the page scrolls or the window changes size.
    const follow = (event: Event) => {
      if (event.target instanceof Node && card.contains(event.target)) return;
      const now = triggerRect(trigger);
      const next = placeMenu(
        now,
        { width: card.offsetWidth, height: card.offsetHeight },
        card.dataset.align === "start" ? "start" : "end",
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
      [shape, scale, x, y].forEach((spring) => spring.stop());
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
        onClick={() => setOpen(!open)}
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
          aria-label={name}
          className="lg-menu-card"
          data-phase={phase}
          data-align={align}
          data-label={label == null ? undefined : ""}
        >
          <span ref={surfaceRef} className="lg-menu-surface" aria-hidden />
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
