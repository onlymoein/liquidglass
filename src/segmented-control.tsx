import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefAttributes,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { createJelly, FLAT } from "./internal/jelly";
import { useRefraction } from "./internal/refraction";
import { createSpring, type Spring } from "./internal/spring";

export interface SegmentedItem {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  items: SegmentedItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

// The lens is larger than the thumb it lifts from, by what iOS 27 measures in parity/.
const LENS_EXTRA = 25;
const THUMB_INSET = 2;
const THUMB_HEIGHT = 28;
const LENS_HEIGHT = 44;
// How far a finger moves before it's a drag and not a tap.
const SLOP = 4;
// A thumb held for less than this still shows its lens.
const LINGER = 240;
// A tapped choice is reached by the lens, which settles flat when it arrives. Measured on iOS.
const FLIGHT = 300;

/** A row of mutually exclusive choices, with a thumb that slides to the chosen one and lifts into a lens under a finger. */
export const SegmentedControl: ForwardRefExoticComponent<SegmentedControlProps & RefAttributes<HTMLDivElement>> =
  /* @__PURE__ */ forwardRef<HTMLDivElement, SegmentedControlProps>(function SegmentedControl(
    { items, value: valueProp, defaultValue, onValueChange, className, style, ...props },
    ref,
  ) {
    const [value, setValue] = useControllable<string | undefined, string>(valueProp, defaultValue ?? items[0]?.value, onValueChange);
    const rootRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLSpanElement>(null);
    const lensRef = useRef<HTMLSpanElement>(null);
    const spring = useRef<Spring | null>(null);
    const dragged = useRef(false);
    const fly = useRef<() => void>(() => {});
    const index = Math.max(0, items.findIndex((item) => item.value === value));
    const latest = useRef({ items, index, setValue });
    useImperativeHandle(ref, () => rootRef.current!);
    useRefraction(lensRef, true);

    useEffect(() => {
      latest.current = { items, index, setValue };
    });

    useEffect(() => {
      const root = rootRef.current!;
      const thumb = thumbRef.current!;
      const lens = lensRef.current!;
      let at = index;
      let amount = 0;
      let grow = { x: 1, y: 1 };
      let across = 0;
      let squashed = FLAT;
      const span = () => root.getBoundingClientRect().width / Math.max(latest.current.items.length, 1);

      // Both follow the same place: the flat thumb at rest, the lens under a finger.
      const draw = () => {
        const segment = span();
        across = segment;
        const face = segment - THUMB_INSET * 2;
        const width = face + LENS_EXTRA;
        const shown = Math.min(1, Math.max(0, amount));
        grow = {
          x: face / width + (1 - face / width) * amount,
          y: THUMB_HEIGHT / LENS_HEIGHT + (1 - THUMB_HEIGHT / LENS_HEIGHT) * amount,
        };
        thumb.style.transform = `translateX(${at * segment}px)`;
        thumb.style.opacity = String(1 - shown);
        lens.style.opacity = String(Math.min(1, shown * 4));
        lens.style.visibility = shown > 0.001 ? "visible" : "hidden";
        lens.style.setProperty("--lg-lift", String(shown));
        // Out of sight there's nothing to trail, so the lens starts afresh each time it's lifted.
        jelly.follow(at * segment, shown < 0.01);
        place();
      };
      // The lens stretches along a drag, and thins across it, by how far it trails the finger.
      const place = () => {
        lens.style.transform = `translate(${at * across + squashed.shift}px, -50%) scale(${grow.x * squashed.x}, ${grow.y * squashed.y})`;
      };
      const jelly = createJelly(
        () => lens.offsetWidth,
        (shape) => {
          squashed = shape;
          place();
        },
        // Dragged straight to the finger, so the body trails it as the slider's does.
        0.35,
      );
      const motion = createSpring(index, 443, 34, (next) => {
        at = next;
        draw();
      });
      const lift = createSpring(0, 2000, 80, (next) => {
        amount = next;
        draw();
      });
      motion.paint();
      spring.current = motion;

      let linger = 0;
      let heldAt = 0;
      const hold = () => {
        clearTimeout(linger);
        heldAt = performance.now();
        lift.tune(2000, 80);
        lift.set(1);
      };
      const release = () => {
        clearTimeout(linger);
        linger = window.setTimeout(() => {
          lift.tune(600, 49);
          lift.set(0);
        }, Math.max(0, LINGER - (performance.now() - heldAt)));
      };

      fly.current = () => {
        clearTimeout(linger);
        lift.tune(2000, 80);
        lift.set(1);
        linger = window.setTimeout(() => {
          lift.tune(600, 49);
          lift.set(0);
        }, FLIGHT);
      };

      // The thumb is taken hold of, not the track, and moves by as much as the finger does.
      let drag: { id: number; x: number; from: number } | null = null;
      let pressing = false;
      const nearest = (place: number) => {
        const { items: all, index: current } = latest.current;
        let best = current;
        let distance = Infinity;
        all.forEach((item, i) => {
          if (!item.disabled && Math.abs(i - place) < distance) {
            best = i;
            distance = Math.abs(i - place);
          }
        });
        return best;
      };
      const down = (event: PointerEvent) => {
        if (!event.isPrimary || event.button) return;
        const pressed = (event.target as Element).closest<HTMLButtonElement>(".lg-segment");
        if (!pressed || pressed.disabled) return;
        dragged.current = false;
        // Elsewhere, nothing moves until it's let go, when the click chooses.
        if (Number(pressed.dataset.index) !== latest.current.index) return;
        pressing = true;
        hold();
        drag = { id: event.pointerId, x: event.clientX, from: latest.current.index };
        root.setPointerCapture?.(event.pointerId);
      };
      const moved = (event: PointerEvent) => {
        if (event.pointerId !== drag?.id) return;
        const by = event.clientX - drag.x;
        if (!dragged.current && Math.abs(by) < SLOP) return;
        dragged.current = true;
        const last = latest.current.items.length - 1;
        motion.set(Math.min(last, Math.max(0, drag.from + by / Math.max(span(), 1))), true);
      };
      const up = (event: PointerEvent) => {
        if (pressing) release();
        pressing = false;
        if (event.pointerId !== drag?.id) return;
        drag = null;
        const { items: all, index: current, setValue: set } = latest.current;
        if (dragged.current && event.type === "pointerup") {
          const chosen = all[nearest(at)];
          if (chosen && all.indexOf(chosen) !== current) set(chosen.value);
        }
        // Back to the chosen one, wherever it let go. A controlled owner may have said no.
        queueMicrotask(() => motion.set(latest.current.index));
      };

      root.addEventListener("pointerdown", down);
      root.addEventListener("pointermove", moved);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      return () => {
        clearTimeout(linger);
        root.removeEventListener("pointerdown", down);
        root.removeEventListener("pointermove", moved);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        motion.stop();
        lift.stop();
        jelly.stop();
      };
      // The springs start where the control does, then follow `index` below.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      spring.current?.set(index);
    }, [index]);

    const move = (event: KeyboardEvent<HTMLDivElement>) => {
      const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const open = items.filter((item) => !item.disabled);
      const at = open.findIndex((item) => item.value === value);
      const next = open[(at + step + open.length) % open.length];
      if (!next) return;
      setValue(next.value);
      event.currentTarget.querySelector<HTMLElement>(`[data-index="${items.indexOf(next)}"]`)?.focus();
    };

    return (
      <div
        ref={rootRef}
        role="radiogroup"
        className={cx("lg-segmented", className)}
        style={{ ...style, "--lg-segments": items.length } as CSSProperties}
        onKeyDown={move}
        {...props}
      >
        <span ref={thumbRef} className="lg-segmented-thumb" aria-hidden />
        <span ref={lensRef} className="lg-glass lg-segmented-lens" aria-hidden />
        {items.map((item, i) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            className="lg-segment"
            aria-checked={i === index}
            tabIndex={i === index ? 0 : -1}
            disabled={item.disabled}
            data-index={i}
            onClick={() => {
              // The click that ends a drag has already chosen.
              if (!dragged.current && i !== index) {
                fly.current();
                setValue(item.value);
              }
              dragged.current = false;
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  });
