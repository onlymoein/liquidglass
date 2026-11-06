import { useEffect, useRef, type JSX, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { reducedMotion, useModal } from "./internal/modal";
import { fitLens, fitRim } from "./internal/refraction";
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

  const drag = useRef<{ id: number; startY: number; startHeight: number; lastY: number; lastAt: number; speed: number } | null>(null);
  const heightOf = () => sheetRef.current!.getBoundingClientRect().height - (new DOMMatrix(getComputedStyle(sheetRef.current!).transform).m42 || 0);

  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, startY: event.clientY, startHeight: heightOf(), lastY: event.clientY, lastAt: event.timeStamp, speed: 0 };
  };
  const moved = (event: ReactPointerEvent<HTMLDivElement>) => {
    const now = drag.current;
    if (!now || event.pointerId !== now.id) return;
    const span = event.timeStamp - now.lastAt;
    if (span > 0) now.speed = ((now.lastY - event.clientY) / span) * 1000;
    now.lastY = event.clientY;
    now.lastAt = event.timeStamp;
    const heights = motion.current?.heights() ?? [];
    const top = Math.max(...heights);
    let next = now.startHeight + now.startY - event.clientY;
    // Past the tallest detent it resists rather than following.
    if (next > top) next = top + (next - top) / 3;
    motion.current?.spring.set(next, true);
  };
  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    const now = drag.current;
    if (!now || event.pointerId !== now.id) return;
    drag.current = null;
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
          <div ref={sheetRef} className="lg-glass lg-sheet">
            <div className="lg-sheet-handle" onPointerDown={down} onPointerMove={moved} onPointerUp={up} onPointerCancel={up}>
              <span className="lg-sheet-grabber" aria-hidden />
            </div>
            <div className="lg-sheet-content">{children}</div>
          </div>
        </>
      )}
    </dialog>
  );
}
