import { useEffect, useRef, type JSX, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { reducedMotion, useModal } from "./internal/modal";
import { fitLens, fitRim } from "./internal/refraction";
import { ownsDrag, scrollers, SLOP, split, whose } from "./internal/sheet-drag";
import { afterGlassShows, createSpring, type Spring } from "./internal/spring";

export type SheetDetent = "medium" | "large";

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The heights it rests at, smallest first. */
  detents?: SheetDetent[];
  children?: ReactNode;
  className?: string;
  "aria-label"?: string;
}

// Measured on iOS 27: half height floats as glass, inset from the screen's edges;
// full height is opaque, reaches them, and keeps its corners only at the top.
const MEDIUM = 0.516;
const LARGE_TOP = 67;
const INSET = 8;
const BOTTOM = 8;
const RADIUS = 38;
const LARGE_RADIUS = 38;
// A fast launch that settles without overshooting, fitted to a recording.
const SPRING = [700, 65] as const;
// A flick this fast, in points a second, counts as meaning it.
const FLICK = 500;

interface Drag {
  id: number;
  startX: number;
  startY: number;
  startHeight: number;
  lastY: number;
  lastAt: number;
  speed: number;
  /** Whether the sheet has taken the drag. A drag that starts on content isn't known to be its until it has gone a little way. */
  claimed: boolean;
  /** What scrolls under the finger, innermost first. */
  scrolling: HTMLElement[];
  /** What the drag scrolls once the sheet is as tall as it gets, and where that began. */
  scroller: HTMLElement | null;
  scrollStart: number;
}

/** The iOS sheet: rises from the bottom, drags between its detents, and drags away. */
export function Sheet({ open: openProp, defaultOpen = false, onOpenChange, detents = ["medium", "large"], children, className, "aria-label": label }: SheetProps): JSX.Element {
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLSpanElement>(null);
  const motion = useRef<{ spring: Spring; heights: () => number[] } | null>(null);
  const { phase, finished } = useModal(dialogRef, open, () => setOpen(false));
  const live = useRef({ finished, detents, phase });
  useEffect(() => {
    live.current = { finished, detents, phase };
  });

  useEffect(() => {
    if (phase === "closed") return;
    const sheet = sheetRef.current!;
    const scrim = scrimRef.current!;
    const heights = () => {
      const screen = dialogRef.current?.clientHeight || innerHeight;
      return live.current.detents.map((detent) => (detent === "medium" ? screen * MEDIUM : screen - LARGE_TOP));
    };
    let stopLens: (() => void) | undefined;
    let height = 0;
    const paint = (next: number) => {
      height = next;
      const screen = dialogRef.current?.clientHeight || innerHeight;
      const medium = screen * MEDIUM;
      const large = screen - LARGE_TOP;
      // Above half height it opens out to the edges and turns opaque; below, it just slides.
      const full = Math.min(1, Math.max(0, (next - medium) / (large - medium)));
      const rest = live.current.detents.length ? Math.min(...heights()) : medium;
      const inset = INSET * (1 - full);
      sheet.style.left = sheet.style.right = `${inset}px`;
      sheet.style.bottom = `${BOTTOM * (1 - full)}px`;
      sheet.style.height = `${Math.max(rest, next)}px`;
      sheet.style.transform = next < rest ? `translateY(${rest - next}px)` : "";
      sheet.style.setProperty("--lg-sheet-full", String(full));
      sheet.style.borderRadius = `${RADIUS + (LARGE_RADIUS - RADIUS) * full}px ${RADIUS + (LARGE_RADIUS - RADIUS) * full}px ${RADIUS * (1 - full)}px ${RADIUS * (1 - full)}px`;
      scrim.style.opacity = String(Math.min(1, Math.max(0, next / rest)));
      if (next === 0 && live.current.phase === "leaving") live.current.finished();
    };
    const spring = createSpring(0, SPRING[0], SPRING[1], (next) => {
      stopLens?.();
      stopLens = undefined;
      paint(next);
    });
    motion.current = { spring, heights };
    spring.paint();
    const stopRim = fitRim(sheet);
    const first = heights()[0] ?? 0;
    const cancelStart = afterGlassShows(() => spring.set(first, reducedMotion()));
    const settled = setInterval(() => {
      if (!stopLens && Math.abs(height - first) < 0.01 && live.current.phase === "open") stopLens = fitLens(sheet);
    }, 300);
    return () => {
      cancelStart();
      clearInterval(settled);
      spring.stop();
      stopLens?.();
      stopRim();
      motion.current = null;
    };
  }, [phase === "closed"]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === "leaving") motion.current?.spring.set(0, reducedMotion());
    if (phase === "open") motion.current?.spring.set(motion.current.heights()[0] ?? 0, reducedMotion());
  }, [phase]);

  const drag = useRef<Drag | null>(null);
  // A drag that began on a button or link ends with a click that isn't a tap.
  const swallow = useRef(0);
  const heightOf = () => sheetRef.current!.getBoundingClientRect().height - (new DOMMatrix(getComputedStyle(sheetRef.current!).transform).m42 || 0);
  const tallest = () => Math.max(...(motion.current?.heights() ?? [0]));

  // The sheet takes the drag: from here it follows the finger, from where the finger is.
  const claim = (now: Drag, y: number, at: number) => {
    const sheet = sheetRef.current!;
    now.claimed = true;
    now.startY = now.lastY = y;
    now.lastAt = at;
    now.speed = 0;
    now.startHeight = heightOf();
    // What's left of an upward drag, once the sheet is as tall as it gets, scrolls whatever can.
    now.scroller = now.scrolling.find((node) => node.scrollTop < node.scrollHeight - node.clientHeight - 1) ?? null;
    now.scrollStart = now.scroller?.scrollTop ?? 0;
    sheet.setAttribute("data-dragging", "");
    // Only now: captured earlier, a button under the finger would never see its click.
    try {
      sheet.setPointerCapture(now.id);
    } catch {
      // The pointer's already gone, and so is the drag.
    }
    getSelection()?.removeAllRanges();
  };

  // Whether the drag is the sheet's. A drag that starts on content is only known once it has
  // gone a little way, and then belongs to the sheet or to the content for good.
  const decide = (now: Drag, x: number, y: number, at: number): boolean => {
    if (now.claimed) return true;
    const dx = x - now.startX;
    const dy = y - now.startY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SLOP) return false;
    const scrolled = now.scrolling.some((node) => node.scrollTop > 0);
    if (Math.abs(dx) > Math.abs(dy) || whose(dy, heightOf(), tallest(), scrolled) === "content") {
      drag.current = null;
      return false;
    }
    claim(now, y, at);
    return true;
  };

  // The browser scrolls a touch on its own unless the first moves are stopped, and a React
  // handler can't stop them, so the sheet listens for itself.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const touch = (event: TouchEvent) => {
      const now = drag.current;
      const point = event.touches[0];
      if (now && point && decide(now, point.clientX, point.clientY, event.timeStamp) && event.cancelable) event.preventDefault();
    };
    sheet.addEventListener("touchmove", touch, { passive: false });
    return () => sheet.removeEventListener("touchmove", touch);
  }, [phase === "closed"]); // eslint-disable-line react-hooks/exhaustive-deps

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const target = event.target as Element;
    // The handle always moves the sheet. Elsewhere a slider or a text field keeps its own drag.
    const handle = target.closest(".lg-sheet-handle") !== null;
    if (!handle && ownsDrag(target)) return;
    const now: Drag = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startHeight: 0,
      lastY: event.clientY,
      lastAt: event.timeStamp,
      speed: 0,
      claimed: false,
      scrolling: handle ? [] : scrollers(target, sheetRef.current!),
      scroller: null,
      scrollStart: 0,
    };
    drag.current = now;
    if (handle) claim(now, event.clientY, event.timeStamp);
  };
  const moved = (event: ReactPointerEvent<HTMLDivElement>) => {
    const now = drag.current;
    if (!now || event.pointerId !== now.id) return;
    // A mouse let go of outside the window sends no end to the drag.
    if (event.pointerType === "mouse" && event.buttons === 0) return up(event);
    if (!decide(now, event.clientX, event.clientY, event.timeStamp)) return;
    const span = event.timeStamp - now.lastAt;
    if (span > 0) now.speed = ((now.lastY - event.clientY) / span) * 1000;
    now.lastY = event.clientY;
    now.lastAt = event.timeStamp;
    const { scroller } = now;
    const room = scroller ? scroller.scrollHeight - scroller.clientHeight - now.scrollStart : 0;
    const { height, scroll } = split(now.startHeight + now.startY - event.clientY, tallest(), room);
    if (scroller) scroller.scrollTop = now.scrollStart + scroll;
    motion.current?.spring.set(height, true);
  };
  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    const now = drag.current;
    if (!now || event.pointerId !== now.id) return;
    drag.current = null;
    // A tap, or a drag the content took.
    if (!now.claimed) return;
    sheetRef.current?.removeAttribute("data-dragging");
    if (event.type === "pointerup") {
      window.clearTimeout(swallow.current);
      swallow.current = window.setTimeout(() => (swallow.current = 0), 100);
    }
    const heights = motion.current?.heights() ?? [];
    const lowest = Math.min(...heights);
    const height = heightOf();
    if (height < lowest * 0.7 || (now.speed < -FLICK && height <= lowest)) {
      setOpen(false);
      return;
    }
    const ahead = height + now.speed * 0.15;
    const nearest = heights.reduce((best, value) => (Math.abs(value - ahead) < Math.abs(best - ahead) ? value : best), heights[0] ?? 0);
    motion.current?.spring.set(nearest);
  };

  return (
    <dialog ref={dialogRef} className={cx("lg-modal lg-sheet-dialog", className)} data-phase={phase} aria-label={label}>
      {phase === "closed" ? null : (
        <>
          <span ref={scrimRef} className="lg-modal-scrim" aria-hidden onClick={() => setOpen(false)} />
          <div
            ref={sheetRef}
            className="lg-glass lg-sheet"
            onPointerDown={down}
            onPointerMove={moved}
            onPointerUp={up}
            onPointerCancel={up}
            onClickCapture={(event) => {
              if (!swallow.current) return;
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            <div className="lg-sheet-handle">
              <span className="lg-sheet-grabber" aria-hidden />
            </div>
            <div className="lg-sheet-content">{children}</div>
          </div>
        </>
      )}
    </dialog>
  );
}
