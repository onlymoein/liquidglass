import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type RefAttributes,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { reducedMotion } from "./internal/modal";
import { useStyles } from "./internal/styles";
import pickerCss from "./styles/picker.css?inline";

export interface PickerItem {
  value: string;
  label: ReactNode;
}

export interface PickerProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** What can be chosen, from the top. */
  items: PickerItem[];
  value?: string;
  defaultValue?: string;
  /** Called when the wheel comes to rest on a row, as `UIPickerView` calls `didSelectRow`, and straight away for a key or a tap. */
  onValueChange?: (value: string) => void;
  /** How many rows show at once. Odd numbers keep the chosen row in the middle. Default 5, from 3 to 9. */
  rows?: number;
}

// Not measured on an iOS 27 simulator: the row, type size and the curve of the drum are set by eye.
const ROW = 34;
/** How far each row is turned round the drum from the one before, in degrees. */
const STEP = 24;
const SETTLE_MS = 120;
const TYPE_MS = 600;

const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const rowOf = (wheel: HTMLElement) => (wheel.firstElementChild as HTMLElement | null)?.offsetHeight || ROW;
const textOf = (item: PickerItem) => (typeof item.label === "string" || typeof item.label === "number" ? String(item.label) : item.value);

/**
 * The iOS wheel picker: rows on a drum that you flick or drag, that comes to rest on one, and the
 * chosen row inside a capsule. Arrow keys, Page Up and Down, Home, End and typing a row's first
 * letters move it too. `className` and `style` are for the picker; every other prop, and the ref,
 * are on the focusable list, so give that an `aria-label`.
 */
export const Picker: ForwardRefExoticComponent<PickerProps & RefAttributes<HTMLDivElement>> = /* @__PURE__ */ forwardRef<
  HTMLDivElement,
  PickerProps
>(function Picker({ items, value: valueProp, defaultValue, onValueChange, rows = 5, className, style, ...props }, ref) {
  useStyles(["picker", pickerCss]);
  const id = useId();
  const [value, setValue] = useControllable(valueProp, defaultValue ?? items[0]?.value ?? "", onValueChange);
  const index = Math.max(0, items.findIndex((item) => item.value === value));
  const shown = clamp(Math.round(rows) % 2 === 0 ? Math.round(rows) + 1 : Math.round(rows), 3, 9);

  const wheelRef = useRef<HTMLDivElement | null>(null);
  const setWheel = useCallback(
    (node: HTMLDivElement | null) => {
      wheelRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  // What the handlers below need, as of the last render, so they needn't be set up again.
  const latest = useRef({ items, value, index, shown, setValue });
  latest.current = { items, value, index, shown, setValue };
  const touching = useRef(false);
  const drag = useRef<{ y: number; top: number; moved: boolean } | null>(null);
  const swallow = useRef(false);
  const styled = useRef<[number, number]>([0, -1]);
  const frame = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const typed = useRef({ text: "", timer: undefined as ReturnType<typeof setTimeout> | undefined });
  const placed = useRef(false);

  // Turns each row near the middle round the drum by how far it is from the middle: pulled
  // together, tilted away and dimmed as it goes. Rows past the reach are left flat; they're
  // out of sight.
  const paint = useCallback(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const { items: list, shown: visible } = latest.current;
    const row = rowOf(wheel);
    const position = wheel.scrollTop / row;
    const radius = row / (2 * Math.sin((STEP * Math.PI) / 360));
    const reach = Math.ceil(visible / 2) + 1;
    const low = Math.max(0, Math.floor(position - reach));
    const high = Math.min(list.length - 1, Math.ceil(position + reach));
    const children = wheel.children;
    const [before, after] = styled.current;
    for (let i = before; i <= after; i++) {
      if (i >= low && i <= high) continue;
      const child = children[i] as HTMLElement | undefined;
      if (child) child.style.transform = child.style.opacity = "";
    }
    for (let i = low; i <= high; i++) {
      const child = children[i] as HTMLElement | undefined;
      if (!child) continue;
      const offset = i - position;
      const angle = clamp(offset * STEP, -90, 90);
      const turned = (angle * Math.PI) / 180;
      const y = radius * Math.sin(turned) - offset * row;
      const z = radius * (Math.cos(turned) - 1);
      child.style.transform = `translate3d(0, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateX(${(-angle).toFixed(2)}deg)`;
      child.style.opacity = Math.max(0, 1 - Math.abs(offset) * 0.3).toFixed(3);
    }
    styled.current = [low, high];
  }, []);

  // Chooses the row the wheel has come to rest on.
  const commit = useCallback(() => {
    const wheel = wheelRef.current;
    if (!wheel || touching.current || drag.current) return;
    const { items: list, value: current, setValue: set } = latest.current;
    const next = list[clamp(Math.round(wheel.scrollTop / rowOf(wheel)), 0, list.length - 1)];
    if (next && next.value !== current) set(next.value);
  }, []);

  // Brings the chosen row to the middle: at once the first time and for reduced motion, and
  // otherwise by scrolling there. A wheel that has already come to rest there is left alone.
  useLayout(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const top = index * rowOf(wheel);
    if (Math.abs(wheel.scrollTop - top) >= 1 && !touching.current && !drag.current) {
      const instant = !placed.current || reducedMotion() || typeof wheel.scrollTo !== "function";
      if (instant) wheel.scrollTop = top;
      else wheel.scrollTo({ top, behavior: "smooth" });
    }
    placed.current = true;
    paint();
  }, [index, items.length, shown, paint]);

  useEffect(() => {
    const wheel = wheelRef.current;
    if (!wheel) return;
    const down = () => (touching.current = true);
    const up = () => {
      touching.current = false;
      clearTimeout(settle.current);
      settle.current = setTimeout(commit, SETTLE_MS);
    };
    const scrolled = () => {
      frame.current ||= requestAnimationFrame(() => {
        frame.current = 0;
        paint();
      });
      clearTimeout(settle.current);
      settle.current = setTimeout(commit, SETTLE_MS);
    };
    const ended = () => {
      clearTimeout(settle.current);
      commit();
    };
    wheel.addEventListener("touchstart", down, { passive: true });
    wheel.addEventListener("touchend", up, { passive: true });
    wheel.addEventListener("touchcancel", up, { passive: true });
    wheel.addEventListener("scroll", scrolled, { passive: true });
    wheel.addEventListener("scrollend", ended);
    return () => {
      wheel.removeEventListener("touchstart", down);
      wheel.removeEventListener("touchend", up);
      wheel.removeEventListener("touchcancel", up);
      wheel.removeEventListener("scroll", scrolled);
      wheel.removeEventListener("scrollend", ended);
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      clearTimeout(settle.current);
      clearTimeout(typed.current.timer);
    };
  }, [commit, paint]);

  const choose = (next: number) => {
    const item = items[clamp(next, 0, items.length - 1)];
    if (item && item.value !== value) setValue(item.value);
  };

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const move = {
      ArrowUp: index - 1,
      ArrowDown: index + 1,
      PageUp: index - (shown - 1),
      PageDown: index + (shown - 1),
      Home: 0,
      End: items.length - 1,
    }[event.key];
    if (move !== undefined) {
      event.preventDefault();
      choose(move);
      return;
    }
    if (event.key.length !== 1 || event.key === " ") return;
    // Typing a row's first letters goes to the next row that begins with them.
    const state = typed.current;
    clearTimeout(state.timer);
    state.text += event.key.toLowerCase();
    state.timer = setTimeout(() => (state.text = ""), TYPE_MS);
    const from = state.text.length === 1 ? index + 1 : index;
    for (let step = 0; step < items.length; step++) {
      const at = (from + step) % items.length;
      if (textOf(items[at]!).toLowerCase().startsWith(state.text)) {
        event.preventDefault();
        choose(at);
        return;
      }
    }
  };

  // A mouse can't flick a scroller, so it's given a drag. Touch scrolls it as it is.
  const grab = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const wheel = event.currentTarget;
    drag.current = { y: event.clientY, top: wheel.scrollTop, moved: false };
  };
  const pull = (event: PointerEvent<HTMLDivElement>) => {
    const grabbed = drag.current;
    if (!grabbed) return;
    const wheel = event.currentTarget;
    const by = event.clientY - grabbed.y;
    if (!grabbed.moved && Math.abs(by) > 3) {
      // Only once it's a drag is the pointer held, as a press that stays still is a tap, and a
      // held pointer sends its click to the wheel and not to the row.
      grabbed.moved = true;
      wheel.setAttribute("data-dragging", "");
      try {
        wheel.setPointerCapture(event.pointerId);
      } catch {
        // A pointer that has already gone, as a pen lifted at once; the drag goes on without it.
      }
    }
    if (grabbed.moved) wheel.scrollTop = grabbed.top - by;
  };
  const drop = (event: PointerEvent<HTMLDivElement>) => {
    const grabbed = drag.current;
    if (!grabbed) return;
    const wheel = event.currentTarget;
    drag.current = null;
    wheel.removeAttribute("data-dragging");
    if (wheel.hasPointerCapture(event.pointerId)) wheel.releasePointerCapture(event.pointerId);
    if (!grabbed.moved) return;
    // The click that ends a drag isn't a tap on a row.
    swallow.current = true;
    setTimeout(() => (swallow.current = false), 0);
    const row = rowOf(wheel);
    const top = clamp(Math.round(wheel.scrollTop / row), 0, items.length - 1) * row;
    if (typeof wheel.scrollTo === "function") wheel.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" });
    else wheel.scrollTop = top;
    clearTimeout(settle.current);
    settle.current = setTimeout(commit, SETTLE_MS);
  };

  const tap = (event: MouseEvent<HTMLDivElement>) => {
    if (swallow.current) return;
    const row = (event.target as HTMLElement).closest<HTMLElement>("[role=option]");
    if (!row || !event.currentTarget.contains(row)) return;
    choose(Array.prototype.indexOf.call(event.currentTarget.children, row));
  };

  return (
    <div className={cx("lg-picker", className)} style={{ ...style, "--lg-picker-rows": shown } as CSSProperties}>
      <div
        ref={setWheel}
        role="listbox"
        tabIndex={0}
        aria-orientation="vertical"
        aria-activedescendant={items.length ? `${id}-${index}` : undefined}
        className="lg-picker-wheel"
        {...props}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (!event.defaultPrevented) keys(event);
        }}
        onPointerDown={(event) => {
          props.onPointerDown?.(event);
          grab(event);
        }}
        onPointerMove={(event) => {
          props.onPointerMove?.(event);
          pull(event);
        }}
        onPointerUp={(event) => {
          props.onPointerUp?.(event);
          drop(event);
        }}
        onPointerCancel={(event) => {
          props.onPointerCancel?.(event);
          drop(event);
        }}
        onClick={(event) => {
          props.onClick?.(event);
          tap(event);
        }}
      >
        {items.map((item, at) => (
          <div key={item.value} id={`${id}-${at}`} role="option" aria-selected={at === index} className="lg-picker-item">
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * Pickers side by side that share one capsule across them, as the iOS time picker's do. Each one
 * keeps its own value; give them the same `rows`.
 */
export const PickerGroup: ForwardRefExoticComponent<HTMLAttributes<HTMLDivElement> & RefAttributes<HTMLDivElement>> = /* @__PURE__ */ forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(function PickerGroup({ className, ...props }, ref) {
  useStyles(["picker", pickerCss]);
  return <div ref={ref} role="group" className={cx("lg-picker-group", className)} {...props} />;
});
