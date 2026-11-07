import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type RefAttributes,
} from "react";

import { outline, type RoundedRect } from "./internal/contour";
import { cx } from "./internal/cx";

export interface GlassGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Glass closer together than this flows into one shape, in points. */
  spacing?: number;
}

// Room round the children for the shape to grow into when one is pressed.
const MARGIN = 24;

/**
 * The glass inside share one surface, as in an iOS `GlassEffectContainer`: pieces
 * that come close flow together, and part again as they move away.
 */
export const GlassGroup: ForwardRefExoticComponent<GlassGroupProps & RefAttributes<HTMLDivElement>> = /* @__PURE__ */ forwardRef<
  HTMLDivElement,
  GlassGroupProps
>(function GlassGroup({ spacing = 20, className, children, ...props }, forwardedRef) {
  const ref = useRef<HTMLDivElement>(null);
  const rimRef = useRef<SVGSVGElement>(null);
  const shadowRef = useRef<SVGSVGElement>(null);
  const shapeRef = useRef<HTMLSpanElement>(null);
  const id = useId().replace(/:/g, "");
  useImperativeHandle(forwardedRef, () => ref.current!);

  useEffect(() => {
    const group = ref.current!;
    const shape = shapeRef.current!;
    const masks = [...rimRef.current!.querySelectorAll("mask")];
    const paths = [...rimRef.current!.querySelectorAll(":scope > path"), ...shadowRef.current!.querySelectorAll("path")];
    let showing = 0;
    let frame = 0;
    let last = "";
    const members = () =>
      [...group.querySelectorAll<HTMLElement>(":scope > .lg-glass:not(.lg-glass-group-shape):not([data-variant='filled'])")];

    const draw = () => {
      frame = 0;
      const box = group.getBoundingClientRect();
      const rects: RoundedRect[] = members().map((member) => {
        const rect = member.getBoundingClientRect();
        const scale = member.offsetWidth ? rect.width / member.offsetWidth : 1;
        const corner = parseFloat(getComputedStyle(member).borderTopLeftRadius) * scale || 0;
        return {
          x: rect.left - box.left + MARGIN,
          y: rect.top - box.top + MARGIN,
          width: rect.width,
          height: rect.height,
          radius: Math.min(corner, rect.width / 2, rect.height / 2),
        };
      });
      const key = rects.map((rect) => Object.values(rect).map((value) => value.toFixed(1)).join()).join("|") + box.width + box.height;
      if (key === last) return;
      last = key;
      const d = outline(rects, spacing, box.width + MARGIN * 2, box.height + MARGIN * 2);
      // WebKit doesn't repaint a mask whose path changes, so each outline goes in the other one.
      showing = 1 - showing;
      const mask = masks[showing]!;
      mask.setAttribute("width", String(box.width + MARGIN * 2));
      mask.setAttribute("height", String(box.height + MARGIN * 2));
      mask.firstElementChild!.setAttribute("d", d);
      shape.style.setProperty("-webkit-mask", `url(#${mask.id})`);
      shape.style.setProperty("mask", `url(#${mask.id})`);
      for (const path of paths) path.setAttribute("d", d);
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(draw);
    };

    // Follow the pieces for as long as anything in them is moving.
    let moving = 0;
    const follow = () => {
      draw();
      moving = group.getAnimations({ subtree: true }).length ? requestAnimationFrame(follow) : 0;
    };
    const started = () => {
      moving ||= requestAnimationFrame(follow);
    };

    const sizes = new ResizeObserver(schedule);
    sizes.observe(group);
    const changes = new MutationObserver(() => {
      for (const member of members()) sizes.observe(member);
      schedule();
    });
    changes.observe(group, { attributes: true, attributeFilter: ["style", "class"], childList: true, subtree: true });
    for (const member of members()) sizes.observe(member);
    group.addEventListener("transitionrun", started);
    group.addEventListener("animationstart", started);
    draw();
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(moving);
      sizes.disconnect();
      changes.disconnect();
      group.removeEventListener("transitionrun", started);
      group.removeEventListener("animationstart", started);
    };
  }, [spacing]);

  return (
    <div ref={ref} className={cx("lg-glass-group", className)} {...props}>
      <svg ref={shadowRef} className="lg-glass-group-layer lg-glass-group-shadow" aria-hidden>
        <path />
      </svg>
      {/* A mask in the page, not an image: it changes in the same frame as the pieces, where
          an image would flash as it loads. A clip-path loses the backdrop in Chromium inside
          rounded overflow. */}
      <span
        ref={shapeRef}
        className="lg-glass lg-glass-group-shape"
        style={{ WebkitMask: `url(#${id}-shape-0)`, mask: `url(#${id}-shape-0)` }}
        aria-hidden
      />
      <svg ref={rimRef} className="lg-glass-group-layer lg-glass-group-rim" aria-hidden>
        <defs>
          {[0, 1].map((which) => (
            <mask key={which} id={`${id}-shape-${which}`} maskUnits="userSpaceOnUse" x="0" y="0">
              <path fill="#fff" />
            </mask>
          ))}
          <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
            <stop offset="0.3" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.34" />
          </linearGradient>
        </defs>
        <path className="lg-glass-group-hairline" />
        <path className="lg-glass-group-line" stroke={`url(#${id}-light)`} />
      </svg>
      {children}
    </div>
  );
});
