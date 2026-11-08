import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
} from "react";

import { Button } from "./button";
import { cx } from "./internal/cx";
import { scroller } from "./internal/scroller";
import { Toolbar, ToolbarGroup, type ToolbarProps } from "./toolbar";

export interface NavigationBarProps extends Omit<ToolbarProps, "title" | "children"> {
  /** The screen's name. Large under the bar, then in the bar once it has scrolled under. */
  title: string;
  /** Show the title large below the bar. Without it the title sits in the bar from the start. Defaults to true. */
  large?: boolean;
  /** Adds the round back button at the leading edge, and is called when it's pressed. */
  onBack?: () => void;
  /** What the back button is called to a screen reader. Defaults to "Back". */
  backLabel?: string;
  /** Actions at the leading edge, after the back button. Put buttons in `ToolbarGroup`s, or use a `Menu`. */
  leading?: ReactNode;
  /** Actions at the trailing edge. */
  trailing?: ReactNode;
  /** The heading level of the title. Defaults to 1. */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

// How far under the bar the large title has to be before the bar shows its own.
const COVERED = 12;

const chevron = (
  <svg viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M15.75 5.5 8.25 13l7.5 7.5" />
  </svg>
);

/**
 * The bar at the top of a screen: an optional back button, actions, and the
 * screen's title. It sticks to the top of what scrolls beneath it like a
 * `Toolbar`, and the large title scrolls away with the content while its
 * smaller twin fades into the bar.
 */
export const NavigationBar: ForwardRefExoticComponent<NavigationBarProps & RefAttributes<HTMLDivElement>> =
  /* @__PURE__ */ forwardRef<HTMLDivElement, NavigationBarProps>(function NavigationBar(
    {
      title,
      large = true,
      onBack,
      backLabel = "Back",
      leading,
      trailing,
      level = 1,
      className,
      "aria-label": label = "Navigation bar",
      ...props
    },
    forwardedRef,
  ) {
    const ref = useRef<HTMLDivElement>(null);
    const heading = useRef<HTMLDivElement>(null);
    useImperativeHandle(forwardedRef, () => ref.current!);

    // The bar swaps to its own title once the large one has scrolled under it.
    useEffect(() => {
      const bar = ref.current;
      const big = heading.current;
      if (!bar || !big) return;
      const target = scroller(bar) ?? window;
      const update = () => bar.toggleAttribute("data-collapsed", big.getBoundingClientRect().bottom - COVERED <= bar.getBoundingClientRect().bottom);
      update();
      target.addEventListener("scroll", update, { passive: true });
      window.addEventListener("resize", update);
      return () => {
        target.removeEventListener("scroll", update);
        window.removeEventListener("resize", update);
        bar.removeAttribute("data-collapsed");
      };
    }, [large]);

    return (
      <>
        <Toolbar
          ref={ref}
          aria-label={label}
          className={cx("lg-nav", className)}
          data-large={large ? "" : undefined}
          {...props}
        >
          <div className="lg-nav-side">
            {onBack && (
              <ToolbarGroup role="presentation">
                <Button aria-label={backLabel} icon={chevron} onClick={onBack} />
              </ToolbarGroup>
            )}
            {leading}
          </div>
          <span
            className="lg-nav-title"
            role={large ? undefined : "heading"}
            aria-level={large ? undefined : level}
            aria-hidden={large ? true : undefined}
          >
            {title}
          </span>
          <div className="lg-nav-side" data-side="trailing">
            {trailing}
          </div>
        </Toolbar>
        {large && (
          <div ref={heading} className="lg-nav-large" role="heading" aria-level={level}>
            {title}
          </div>
        )}
      </>
    );
  });
