import { useEffect, useRef, useState, type RefObject } from "react";

export const stroke = (d: string, width = 1.8) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

export const icons = {
  plus: "M12 5v14M5 12h14",
  copy: "M9 9h10v11H9zM5 15V4h10",
  trash: "M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13",
  share: "M12 15V4M8 8l4-4 4 4M6 12v8h12v-8",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  sort: "M4 7h16M7 12h10M10 17h4",
  sliders: "M4 7h9M18 7h2M4 17h2M11 17h9M15.5 4.5v5M8.5 14.5v5",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  phone: "M8 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2",
  columns: "M4 5h16v14H4zM12 5v14",
  swatch: "M4 8l8-4 8 4-8 4zM4 12l8 4 8-4M4 16l8 4 8-4",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1",
  drop: "M12 3s7 7.2 7 12a7 7 0 0 1-14 0c0-4.800 7-12 7-12z",
  inbox: "M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h4l1 2h6l1-2h4",
  doc: "M6 3h9l4 4v14H6zM14 3v5h5",
  send: "M21 3 3 10.500l7 3 3 7.500zM10 13.500 21 3",
  folder: "M3 6h6l2 2h10v11H3z",
};

/** Only Chromium can bend the live backdrop. The library checks the same way. */
export const refracts = () => /Chrom(?:e|ium)\//.test(navigator.userAgent);

export function browserName(): "Chromium" | "Safari" | "Firefox" {
  if (refracts()) return "Chromium";
  return /Firefox\//.test(navigator.userAgent) ? "Firefox" : "Safari";
}

/**
 * Glass works out its lens when its size changes, so settings changed at runtime
 * need it to look again. This moves each piece by a fraction of a pixel and back.
 */
export function refit(root: ParentNode = document): void {
  const pieces = [...root.querySelectorAll<HTMLElement>(".lg-glass:not(.lg-glass-group-shape)")].filter((piece) => piece.offsetWidth);
  const undo = pieces.map((piece) => {
    const { minWidth, boxSizing } = piece.style;
    piece.style.boxSizing = "border-box";
    // The exact width: offsetWidth rounds, and a smaller minimum wouldn't move it.
    piece.style.minWidth = `${parseFloat(getComputedStyle(piece).width) + 0.05}px`;
    return () => {
      piece.style.minWidth = minWidth;
      piece.style.boxSizing = boxSizing;
    };
  });
  requestAnimationFrame(() => requestAnimationFrame(() => undo.forEach((restore) => restore())));
}

export function useCopied(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = (text: string) => {
    // Only says so if the browser allowed it.
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    }, () => {});
  };
  return [copied, copy];
}

interface ThrowOptions {
  /** Where it starts, from the room it has and its own size. */
  start: (room: { width: number; height: number }, own: { width: number; height: number }) => { x: number; y: number };
  /** How fast it's moving when the page opens, in points a second. */
  kick?: { x: number; y: number };
  onMove?: () => void;
}

const FRICTION = 3.2; // Per second.
const BOUNCE = 0.62;

/** Lets an absolutely placed element be dragged and thrown round its parent, bouncing off the sides. */
export function useThrow(ref: RefObject<HTMLElement | null>, { start, kick, onMove }: ThrowOptions): void {
  const moved = useRef(onMove);
  moved.current = onMove;
  useEffect(() => {
    const element = ref.current!;
    const parent = element.parentElement!;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const room = () => ({ width: parent.clientWidth - element.offsetWidth, height: parent.clientHeight - element.offsetHeight });
    const first = start({ width: parent.clientWidth, height: parent.clientHeight }, { width: element.offsetWidth, height: element.offsetHeight });
    let [x, y] = [first.x, first.y];
    let [vx, vy] = calm || !kick ? [0, 0] : [kick.x, kick.y];
    let grab: { id: number; dx: number; dy: number; at: number } | null = null;
    let frame = 0;
    let previous = 0;

    const paint = () => {
      element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    };
    const keepInside = (bounce: boolean) => {
      const { width, height } = room();
      if (x < 0 || x > width) {
        x = Math.max(0, Math.min(width, x));
        vx = bounce ? -vx * BOUNCE : 0;
      }
      if (y < 0 || y > height) {
        y = Math.max(0, Math.min(height, y));
        vy = bounce ? -vy * BOUNCE : 0;
      }
    };
    const glide = (now: number) => {
      const step = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      x += vx * step;
      y += vy * step;
      const slow = Math.exp(-FRICTION * step);
      vx *= slow;
      vy *= slow;
      keepInside(true);
      paint();
      frame = Math.hypot(vx, vy) > 6 ? requestAnimationFrame(glide) : 0;
    };
    const launch = () => {
      cancelAnimationFrame(frame);
      previous = performance.now();
      frame = requestAnimationFrame(glide);
    };

    const down = (event: PointerEvent) => {
      if (event.button) return;
      cancelAnimationFrame(frame);
      element.setPointerCapture(event.pointerId);
      element.dataset.held = "";
      grab = { id: event.pointerId, dx: event.clientX - x, dy: event.clientY - y, at: performance.now() };
      vx = vy = 0;
    };
    const move = (event: PointerEvent) => {
      if (grab?.id !== event.pointerId) return;
      const now = performance.now();
      const [nextX, nextY] = [event.clientX - grab.dx, event.clientY - grab.dy];
      const step = Math.max(1, now - grab.at) / 1000;
      // Mostly the latest movement, so a flick throws it the way it was going.
      vx = vx * 0.3 + ((nextX - x) / step) * 0.7;
      vy = vy * 0.3 + ((nextY - y) / step) * 0.7;
      x = nextX;
      y = nextY;
      grab.at = now;
      keepInside(false);
      paint();
      moved.current?.();
    };
    const up = (event: PointerEvent) => {
      if (grab?.id !== event.pointerId) return;
      // A finger held still before letting go shouldn't throw it.
      const still = performance.now() - grab.at > 80;
      grab = null;
      delete element.dataset.held;
      if (calm || still) vx = vy = 0;
      else launch();
    };
    const key = (event: KeyboardEvent) => {
      const step = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[event.key];
      if (!step) return;
      event.preventDefault();
      x += step[0]!;
      y += step[1]!;
      keepInside(false);
      paint();
      moved.current?.();
    };
    const resized = new ResizeObserver(() => {
      keepInside(false);
      paint();
    });

    keepInside(false);
    paint();
    if (vx || vy) launch();
    resized.observe(parent);
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", up);
    element.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", up);
      element.removeEventListener("keydown", key);
    };
    // Set up once: the element keeps its place across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}
