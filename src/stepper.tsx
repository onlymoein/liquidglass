import {
  forwardRef,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
} from "react";

import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";

export interface StepperProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

const glyph = (path: string) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
    <path d={path} />
  </svg>
);

/** Two buttons that step a number down and up. */
export const Stepper: ForwardRefExoticComponent<StepperProps & RefAttributes<HTMLDivElement>> = /* @__PURE__ */ forwardRef<
  HTMLDivElement,
  StepperProps
>(function Stepper(
  { value: valueProp, defaultValue = 0, onValueChange, min = -Infinity, max = Infinity, step = 1, disabled, className, ...props },
  ref,
) {
  const [value, setValue] = useControllable(valueProp, defaultValue, onValueChange);
  const change = (direction: number) => setValue(Math.min(max, Math.max(min, value + direction * step)));
  return (
    <div ref={ref} role="group" className={cx("lg-stepper", className)} {...props}>
      <button type="button" className="lg-stepper-button" aria-label="Decrease" disabled={disabled || value <= min} onClick={() => change(-1)}>
        {glyph("M1.5 8h13")}
      </button>
      <span className="lg-stepper-divider" aria-hidden />
      <button type="button" className="lg-stepper-button" aria-label="Increase" disabled={disabled || value >= max} onClick={() => change(1)}>
        {glyph("M1.5 8h13M8 1.5v13")}
      </button>
    </div>
  );
});
