import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
} from "react";

import { cx } from "./internal/cx";
import { scroller } from "./internal/scroller";
import { useStyles } from "./internal/styles";
import scrollEdgeCss from "./styles/scroll-edge.css?inline";

export interface ScrollEdgeProps extends HTMLAttributes<HTMLDivElement> {
  /** Which end of the scrolling area it guards. Defaults to "bottom", where the tab bar floats. */
  side?: "top" | "bottom";
  /**
   * How it frosts what scrolls under it. `uniform` is a tinted band, as on iOS 27;
   * `soft` only blurs and fades it, as on iOS 26. Defaults to "uniform".
   */
  edge?: "uniform" | "soft";
  /** How tall the band is, in pixels: the bar it sits behind, and the fade above it. Defaults to 100. */
  size?: number;
}

// Content this close to the edge counts as not being under it. Scroll offsets are fractions of a pixel on high-density screens.
const SLACK = 1;

/**
 * The soft edge iOS gives a scrolling screen where a bar floats over it. Put it
 * last inside whatever scrolls, and when content runs under the bottom of the
 * screen, a frosted band fades in beneath the tab bar or toolbar. With
 * `side="top"` it goes first and guards the top, for a bar that isn't a
 * `Toolbar` (which does this on its own).
 */
export const ScrollEdge: ForwardRefExoticComponent<ScrollEdgeProps & RefAttributes<HTMLDivElement>> = /* @__PURE__ */ forwardRef<
  HTMLDivElement,
  ScrollEdgeProps
>(function ScrollEdge({ side = "bottom", edge = "uniform", size = 100, className, style, ...props }, forwardedRef) {
  useStyles(["scroll-edge", scrollEdgeCss]);
  const ref = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current!);

  // The band is there while there's content beyond the edge to frost, and not once the
  // scroll has run out or there was never any.
  useEffect(() => {
    const band = ref.current;
    if (!band) return;
    const box = scroller(band);
    const target = box ?? window;
    const area = box ?? document.documentElement;
    const update = () => {
      const offset = box ? box.scrollTop : window.scrollY;
      const beyond = side === "top" ? offset : area.scrollHeight - area.clientHeight - offset;
      band.toggleAttribute("data-active", beyond > SLACK);
    };
    update();
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Content that comes and goes, such as another tab's screen, changes how far there is to
    // scroll without anything scrolling.
    const sizes = new ResizeObserver(update);
    const watch = () => {
      sizes.disconnect();
      sizes.observe(area);
      for (const child of area.children) if (child !== band) sizes.observe(child);
    };
    watch();
    const children = new MutationObserver(() => {
      watch();
      update();
    });
    children.observe(area, { childList: true });
    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      sizes.disconnect();
      children.disconnect();
      band.removeAttribute("data-active");
    };
  }, [side]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cx("lg-scroll-edge", className)}
      data-side={side}
      data-edge={edge}
      style={{ "--lg-edge-size": `${size}px`, ...style } as CSSProperties}
      {...props}
    />
  );
});
