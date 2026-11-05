import {
  forwardRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
} from "react";

import { cx } from "./internal/cx";

export interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  /** How far along, from 0 to 1. */
  value: number;
}

/** A thin bar that fills as work goes on. */
export const Progress: ForwardRefExoticComponent<ProgressProps & RefAttributes<HTMLDivElement>> = /* @__PURE__ */ forwardRef<
  HTMLDivElement,
  ProgressProps
>(function Progress({ value, className, style, ...props }, ref) {
  const amount = Math.min(1, Math.max(0, value));
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={amount}
      className={cx("lg-progress", className)}
      style={{ ...style, "--lg-progress": amount } as CSSProperties}
      {...props}
    >
      <span className="lg-progress-fill" />
    </div>
  );
});

export type SpinnerProps = HTMLAttributes<HTMLSpanElement>;

const BLADES = [0, 1, 2, 3, 4, 5, 6, 7];

/** The iOS activity indicator: eight blades that fade round in turn. */
export const Spinner: ForwardRefExoticComponent<SpinnerProps & RefAttributes<HTMLSpanElement>> = /* @__PURE__ */ forwardRef<
  HTMLSpanElement,
  SpinnerProps
>(function Spinner({ className, ...props }, ref) {
  return (
    <span ref={ref} role="status" aria-label="Loading" className={cx("lg-spinner", className)} {...props}>
      {BLADES.map((blade) => (
        <i key={blade} style={{ "--lg-blade": blade } as CSSProperties} />
      ))}
    </span>
  );
});
