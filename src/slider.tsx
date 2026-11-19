import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type InputHTMLAttributes,
  type ReactNode,
  type RefAttributes,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { createJelly, type Jelly } from "./internal/jelly";
import { useRefraction } from "./internal/refraction";
import { createSpring, DROP, LIFT } from "./internal/spring";
import { useStyles } from "./internal/styles";
import thumbCss from "./styles/thumb.css?inline";
import sliderCss from "./styles/slider.css?inline";

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
  /**
   * Marks along the track. `true` puts one at every step, as SwiftUI's stepped slider does, and
   * draws none when that would be more than 50. A list puts one at each value in it.
   */
  ticks?: boolean | readonly number[];
  /** Shown before the track, small and in secondary ink, like UISlider's minimum value image. */
  minimumIcon?: ReactNode;
  /** Shown after the track, like UISlider's maximum value image. */
  maximumIcon?: ReactNode;
}

// The width of the thumb at rest, which is how far short of each end its centre stops.
const THUMB = 37;

// Past this many, marks would run together, so a plain `ticks` draws none.
const MOST_TICKS = 50;
const MOST_LISTED = 200;

/** Where the marks go: each step, or each listed value that is on the track, once, in order. */
export function tickValues(ticks: boolean | readonly number[] | undefined, min: number, max: number, step: number): number[] {
  if (!ticks || !(max > min)) return [];
  if (ticks === true) {
    const count = Math.round((max - min) / step);
    if (!(step > 0) || !(count >= 1) || count > MOST_TICKS) return [];
    return Array.from({ length: count + 1 }, (_, index) => Number((min + index * step).toFixed(6)));
  }
  const on = ticks.filter((value) => Number.isFinite(value) && value >= min && value <= max);
  return [...new Set(on)].sort((a, b) => a - b).slice(0, MOST_LISTED);
}

export const Slider: ForwardRefExoticComponent<SliderProps & RefAttributes<HTMLInputElement>> = /* @__PURE__ */ forwardRef<
  HTMLInputElement,
  SliderProps
>(function Slider(
  { value: valueProp, defaultValue, onValueChange, min = 0, max = 100, step = 1, ticks, minimumIcon, maximumIcon, className, style, ...props },
  forwardedRef,
) {
  useStyles(["thumb", thumbCss], ["slider", sliderCss]);
  const inputRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const faceRef = useRef<HTMLSpanElement>(null);
  const jelly = useRef<{ jelly: Jelly; held: boolean; place: () => number } | null>(null);
  const [value, setValue] = useControllable(valueProp, defaultValue ?? min, onValueChange);
  const progress = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;
  useImperativeHandle(forwardedRef, () => inputRef.current!);
  useRefraction(thumbRef, true);
  const marks = tickValues(ticks, min, max, step);

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
    const lift = createSpring(0, ...LIFT, (amount) => {
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
          // The fill ends under the thumb's middle as it's drawn, trailing the finger with it,
          // not where the value alone would put it.
          root.style.setProperty("--lg-shift", `${shape.shift}px`);
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
      lift.tune(...LIFT);
      lift.set(1);
      trail.held = true;
      trail.jelly.follow(trail.place(), true);
    };
    const release = () => {
      clearTimeout(linger);
      linger = window.setTimeout(() => {
        lift.tune(...DROP);
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
      root.style.removeProperty("--lg-shift");
      input.removeEventListener("pointerdown", hold);
      ends.forEach((type) => input.removeEventListener(type, release));
      window.removeEventListener("pointerup", release);
    };
  }, []);

  return (
    <div className={cx("lg-slider", className)} style={{ ...style, "--lg-progress": progress } as CSSProperties}>
      {minimumIcon ? (
        <span className="lg-slider-icon" aria-hidden>
          {minimumIcon}
        </span>
      ) : null}
      <div className="lg-slider-body">
        <span className="lg-slider-track" aria-hidden>
          <span className="lg-slider-fill" />
          {marks.map((mark) => (
            <span
              key={mark}
              className="lg-slider-tick"
              data-passed={mark <= value ? "" : undefined}
              style={{ "--lg-at": (mark - min) / (max - min) } as CSSProperties}
            />
          ))}
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
      {maximumIcon ? (
        <span className="lg-slider-icon" aria-hidden>
          {maximumIcon}
        </span>
      ) : null}
    </div>
  );
});
