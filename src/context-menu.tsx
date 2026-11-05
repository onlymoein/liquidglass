import {
  useEffect,
  useRef,
  useState,
  type JSX,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { reducedMotion, useModal } from "./internal/modal";
import { placeMenu } from "./internal/placement";
import { fitRim } from "./internal/refraction";
import { createSpring } from "./internal/spring";
import type { MenuEntry } from "./menu";

export interface ContextMenuProps {
  items: MenuEntry[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The element to hold down, or right-click. */
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}

const HOLD_MS = 500;
const GAP = 10;
const SLOP = 8;

/**
 * Holding the element down, or right-clicking it, lifts a copy of it over a dimmed
 * page and opens a menu beside it.
 */
export function ContextMenu({ items, open: openProp, defaultOpen = false, onOpenChange, children, className, "aria-label": label }: ContextMenuProps): JSX.Element {
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

  const show = () => {
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
    card.querySelector<HTMLElement>(".lg-menu-item:not(:disabled)")?.focus({ preventScroll: true });
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
      <dialog ref={dialogRef} className="lg-modal lg-context" data-phase={phase} aria-label={label}>
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
                  if ("heading" in item) return <div key={index} className="lg-menu-heading">{item.heading}</div>;
                  return (
                    <button
                      key={index}
                      type="button"
                      role="menuitem"
                      className="lg-menu-item"
                      disabled={item.disabled}
                      data-destructive={item.destructive ? "" : undefined}
                      onClick={() => {
                        setOpen(false);
                        item.onSelect?.();
                      }}
                    >
                      {item.icon}
                      {item.label}
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
