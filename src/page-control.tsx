import {
  forwardRef,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
} from "react";

import { Glass } from "./glass";
import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";

export interface PageControlProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  /** How many pages there are. */
  count: number;
  /** The current page, from 0. */
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Draw the dots on a capsule of glass, as the iOS "prominent" page control does. Default true. */
  glass?: boolean;
}

/** The iOS page control: a row of dots with the current page filled, on a capsule of glass. */
export const PageControl: ForwardRefExoticComponent<PageControlProps & RefAttributes<HTMLDivElement>> = /* @__PURE__ */ forwardRef<
  HTMLDivElement,
  PageControlProps
>(function PageControl({ count, value: valueProp, defaultValue = 0, onValueChange, glass = true, className, ...props }, ref) {
  const [value, setValue] = useControllable(valueProp, defaultValue, onValueChange);
  const pages = Math.max(0, Math.floor(count));
  const current = Math.min(Math.max(value, 0), Math.max(pages - 1, 0));
  const go = (page: number) => {
    if (page >= 0 && page < pages && page !== current) setValue(page);
  };
  const dots = Array.from({ length: pages }, (_, page) => (
    <button
      key={page}
      type="button"
      className="lg-page-dot"
      aria-label={`Page ${page + 1} of ${pages}`}
      aria-current={page === current ? "page" : undefined}
      tabIndex={page === current ? 0 : -1}
      onClick={() => go(page)}
    />
  ));
  const keys = (event: React.KeyboardEvent<HTMLElement>) => {
    const next = { ArrowLeft: current - 1, ArrowUp: current - 1, ArrowRight: current + 1, ArrowDown: current + 1, Home: 0, End: pages - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    go(next);
    (event.currentTarget.children[Math.min(Math.max(next, 0), pages - 1)] as HTMLElement | undefined)?.focus();
  };
  const body = (
    <div className="lg-page-dots" onKeyDown={keys}>
      {dots}
    </div>
  );
  if (!glass) return <div ref={ref} role="group" className={cx("lg-page-control", className)} {...props}>{body}</div>;
  return (
    <Glass ref={ref} role="group" className={cx("lg-page-control", className)} {...props}>
      {body}
    </Glass>
  );
});
