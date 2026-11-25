import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { checkmark } from "./internal/checkmark";
import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { safeHref } from "./internal/href";
import { reducedMotion, useModal } from "./internal/modal";
import { placeMenu } from "./internal/placement";
import { fitRim } from "./internal/refraction";
import { createSpring } from "./internal/spring";
import type { MenuEntry, MenuItem } from "./menu";
import { useStyles } from "./internal/styles";
import buttonCss from "./styles/button.css?inline";
import menuCss from "./styles/menu.css?inline";
import layerCss from "./styles/layer.css?inline";
import contextMenuCss from "./styles/context-menu.css?inline";

export interface ContextMenuProps {
  /** The same entries as a Menu's: rows, headings and separators, with `checked`, `href`, `keepOpen` and the rest. */
  items: MenuEntry[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The element to hold down, or right-click. */
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

// Whether the browser would ring this element, as it does one a keyboard has focused. Where it can't say, it's taken to.
const ringed = (element: Element) => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
};

const HOLD_MS = 500;
const GAP = 10;
const SLOP = 8;

/**
 * Holding the element down, or right-clicking it, lifts a copy of it over a dimmed
 * page and opens a menu beside it.
 */
export function ContextMenu({ items, open: openProp, defaultOpen = false, onOpenChange, children, className, "aria-label": label }: ContextMenuProps): JSX.Element {
  useStyles(["button", buttonCss], ["menu", menuCss], ["layer", layerCss], ["context-menu", contextMenuCss]);
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const targetRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  const [from, setFrom] = useState<DOMRect | null>(null);
  const { phase, finished } = useModal(dialogRef, open, () => setOpen(false));
  const done = useRef(finished);
  useEffect(() => {
    done.current = finished;
  });

  // A keyboard opens the menu on its first row; a finger or a mouse has no use for that, and it'd come up ringed.
  const byKeyboard = useRef(false);
  const show = () => {
    const held = document.activeElement;
    byKeyboard.current = held != null && targetRef.current!.contains(held) && ringed(held);
    setFrom(targetRef.current!.getBoundingClientRect());
    setOpen(true);
  };

  // A hold that doesn't wander opens the menu; a scroll or a release cancels it.
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  };
  useEffect(() => cancelHold, []);
  const down = (event: ReactPointerEvent) => {
    if (event.button !== 0 || event.pointerType === "mouse") return;
    hold.current = { timer: setTimeout(show, HOLD_MS), x: event.clientX, y: event.clientY };
  };
  const moved = (event: ReactPointerEvent) => {
    if (hold.current && Math.hypot(event.clientX - hold.current.x, event.clientY - hold.current.y) > SLOP) cancelHold();
  };
  const context = (event: ReactMouseEvent) => {
    event.preventDefault();
    cancelHold();
    show();
  };

  // What choosing an item does is what it does in a Menu: it closes the menu unless it keeps it open,
  // and follows its link (a Cmd, Ctrl or Shift click opens it in a new tab) when it has one.
  const choose = (item: MenuItem, event: ReactMouseEvent) => {
    const href = safeHref(item.href);
    if (href) event.preventDefault();
    const elsewhere = event.metaKey || event.ctrlKey || event.shiftKey;
    if (!item.keepOpen || (href && elsewhere)) setOpen(false);
    if (href && elsewhere) window.open(href, "_blank", "noopener");
    else if (item.onSelect) item.onSelect();
    else if (href) window.location.assign(href);
  };

  // The arrow keys, Home and End move along the rows, and wrap round.
  const navigate = (event: ReactKeyboardEvent) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const rows = [...cardRef.current!.querySelectorAll<HTMLElement>(".lg-menu-item:not(:disabled)")];
    const index = rows.indexOf(document.activeElement as HTMLElement);
    const down = event.key === "ArrowDown";
    const next =
      event.key === "Home" || (index < 0 && down)
        ? 0
        : event.key === "End" || index < 0
          ? rows.length - 1
          : (index + (down ? 1 : -1) + rows.length) % rows.length;
    rows[next]?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (phase === "closed") return;
    const card = cardRef.current!;
    const lift = liftRef.current!;
    const box = from ?? targetRef.current!.getBoundingClientRect();
    const stopRim = fitRim(card);
    const screen = { width: innerWidth, height: innerHeight };
    const size = { width: card.offsetWidth, height: card.offsetHeight };
    const below = box.bottom + GAP + size.height <= screen.height - 8;
    const place = placeMenu({ left: box.left, top: below ? box.bottom + GAP : box.top - GAP - size.height, width: box.width, height: 0 }, size, "center", screen);
    card.style.left = `${place.left}px`;
    card.style.top = `${below ? box.bottom + GAP : box.top - GAP - size.height}px`;
    card.style.transformOrigin = below ? "50% 0" : "50% 100%";
    lift.style.left = `${box.left}px`;
    lift.style.top = `${box.top}px`;
    lift.style.width = `${box.width}px`;
    lift.style.height = `${box.height}px`;
    const spring = createSpring(0, 443, 24.8, (value) => {
      const t = Math.min(1, Math.max(0, value));
      card.style.transform = `scale(${0.3 + 0.7 * Math.max(0, value)})`;
      card.style.opacity = String(Math.min(1, t * 3));
      lift.style.transform = `scale(${1 + 0.03 * Math.sin(Math.min(1, t) * Math.PI)})`;
      if (value === 0 && phaseRef.current === "leaving") done.current();
    });
    springRef.current = spring;
    spring.paint();
    spring.set(1, reducedMotion());
    if (byKeyboard.current) card.querySelector<HTMLElement>(".lg-menu-item:not(:disabled)")?.focus({ preventScroll: true });
    return () => {
      spring.stop();
      springRef.current = null;
      stopRim();
    };
  }, [phase === "closed"]); // eslint-disable-line react-hooks/exhaustive-deps

  const phaseRef = useRef(phase);
  const springRef = useRef<ReturnType<typeof createSpring> | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
    if (phase === "leaving") {
      springRef.current?.tune(900, 60);
      springRef.current?.set(0, reducedMotion());
    }
  }, [phase]);

  return (
    <>
      <div
        ref={targetRef}
        className={cx("lg-context-target", className)}
        onPointerDown={down}
        onPointerMove={moved}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={context}
      >
        {children}
      </div>
      <dialog ref={dialogRef} className="lg-modal lg-context" data-phase={phase} aria-label={label} onKeyDown={navigate}>
        {phase === "closed" ? null : (
          <>
            <span className="lg-modal-scrim" aria-hidden onClick={() => setOpen(false)} />
            <div ref={liftRef} className="lg-context-lift" aria-hidden>
              {children}
            </div>
            <div ref={cardRef} role="menu" className="lg-glass lg-context-card">
              <div className="lg-menu-content">
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
                    "data-destructive": item.destructive ? "" : undefined,
                    onClick: (event: ReactMouseEvent) => choose(item, event),
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
                  const href = safeHref(item.href);
                  return href && !item.disabled ? (
                    <a key={index} href={href} {...props}>
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
          </>
        )}
      </dialog>
    </>
  );
}
