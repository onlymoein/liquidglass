import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type InputHTMLAttributes,
  type RefAttributes,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { createJelly, type Jelly } from "./internal/jelly";
import { useRefraction } from "./internal/refraction";
import { createSpring } from "./internal/spring";

export interface SliderProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step"
  > {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

// The width of the thumb at rest, which is how far short of each end its centre stops.
const THUMB = 37;

export const Slider: ForwardRefExoticComponent<SliderProps & RefAttributes<HTMLInputElement>> = /* @__PURE__ */ forwardRef<
  HTMLInputElement,
  SliderProps
>(function Slider(
  { value: valueProp, defaultValue, onValueChange, min = 0, max = 100, step = 1, className, style, ...props },
  forwardedRef,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const faceRef = useRef<HTMLSpanElement>(null);
  const jelly = useRef<{ jelly: Jelly; held: boolean; place: () => number } | null>(null);
  const [value, setValue] = useControllable(valueProp, defaultValue ?? min, onValueChange);
  const progress = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  useImperativeHandle(forwardedRef, () => inputRef.current!);
  useRefraction(thumbRef, true);

  const latest = useRef({ value, setValue, min, max, step });
  useEffect(() => {
    latest.current = { value, setValue, min, max, step };
  });

  // Under a finger the thumb trails it, stretching as it goes and swinging back when it stops.
  useEffect(() => {
    const trail = jelly.current;
    if (trail) trail.jelly.follow(trail.place(), !trail.held);
  }, [progress]);

  useEffect(() => {
    const input = inputRef.current!;
    const thumb = thumbRef.current!;
    const face = faceRef.current!;
    const lift = createSpring(0, 2000, 80, (amount) => {
      const shown = Math.min(1, Math.max(0, amount));
      thumb.style.scale = String(0.627 + 0.373 * amount);
      face.style.opacity = String(1 - shown);
      thumb.style.setProperty("--lg-lift", String(shown));
    });

    const root = input.parentElement!;
    const trail = {
      held: false,
      // Where the thumb is along the track, in px.
      place: () => {
        const { value: now, min: low, max: high } = latest.current;
        return ((root.offsetWidth - THUMB) * (now - low)) / Math.max(high - low, 1e-6);
      },
      jelly: createJelly(
        () => thumb.offsetWidth,
        (shape) => {
          thumb.style.transform = shape.x === 1 && shape.y === 1 && !shape.shift ? "" : `translateX(${shape.shift}px) scale(${shape.x}, ${shape.y})`;
        },
        // The thumb is set straight to the finger's place, so it shows the lag itself.
        0.35,
      ),
    };
    jelly.current = trail;

    // A quick tap still shows the lens, as on iOS.
    let linger = 0;
    let heldAt = 0;
    const hold = () => {
      if (input.disabled) return;
      clearTimeout(linger);
      heldAt = performance.now();
      lift.tune(2000, 80);
      lift.set(1);
      trail.held = true;
      trail.jelly.follow(trail.place(), true);
    };
    const release = () => {
      clearTimeout(linger);
      linger = window.setTimeout(() => {
        lift.tune(600, 49);
        lift.set(0);
        trail.held = false;
      }, Math.max(0, 240 - (performance.now() - heldAt)));
    };
    const ends = ["pointerup", "pointercancel", "lostpointercapture", "blur"] as const;

    // A finger takes hold of the thumb, not the track, and moves it by as much as it moves.
    let drag: { id: number; x: number; from: number; span: number } | null = null;
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !event.isPrimary || input.disabled || !matchMedia("(pointer: coarse)").matches) return;
      const { value: now, min: low, max: high } = latest.current;
      const box = root.getBoundingClientRect();
      const span = box.width - THUMB;
      const at = box.left + THUMB / 2 + (span * (now - low)) / Math.max(high - low, 1e-6);
      if (Math.abs(event.clientX - at) > THUMB / 2 + 12) return;
      drag = { id: event.pointerId, x: event.clientX, from: now, span };
      root.setPointerCapture?.(event.pointerId);
      hold();
    };
    const moved = (event: PointerEvent) => {
      if (event.pointerId !== drag?.id) return;
      const { setValue: set, value: now, min: low, max: high, step: by } = latest.current;
      const raw = drag.from + ((event.clientX - drag.x) / Math.max(drag.span, 1)) * (high - low);
      const stepped = low + Math.round((raw - low) / by) * by;
      const next = Math.min(high, Math.max(low, Number(stepped.toFixed(6))));
      if (next !== now) set(next);
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== drag?.id) return;
      drag = null;
      release();
    };

    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", moved);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", up);
    input.addEventListener("pointerdown", hold);
    ends.forEach((type) => input.addEventListener(type, release));
    window.addEventListener("pointerup", release);
    return () => {
      clearTimeout(linger);
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", moved);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
      lift.stop();
      trail.jelly.stop();
      jelly.current = null;
      thumb.style.transform = "";
      input.removeEventListener("pointerdown", hold);
      ends.forEach((type) => input.removeEventListener(type, release));
      window.removeEventListener("pointerup", release);
    };
  }, []);

  return (
    <div className={cx("lg-slider", className)} style={{ ...style, "--lg-progress": progress } as CSSProperties}>
      <span className="lg-slider-track" aria-hidden>
        <span className="lg-slider-fill" />
      </span>
      <span ref={thumbRef} className="lg-glass lg-slider-thumb" aria-hidden>
        <span ref={faceRef} className="lg-thumb-face" />
      </span>
      <input
        ref={inputRef}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => setValue(event.currentTarget.valueAsNumber)}
        {...props}
      />
    </div>
  );
});
