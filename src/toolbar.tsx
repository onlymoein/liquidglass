import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type ForwardRefExoticComponent,
  type HTMLAttributes,
  type KeyboardEvent,
  type RefAttributes,
} from "react";

import { cx } from "./internal/cx";
import { useRefraction } from "./internal/refraction";
import { scroller } from "./internal/scroller";

export interface ToolbarProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * What the bar does when content scrolls under it. `uniform` frosts a band
   * across the whole bar, as on iOS 27; `soft` only blurs it, as on iOS 26.
   */
  edge?: "uniform" | "soft" | "none";
}

export type ToolbarGroupProps = HTMLAttributes<HTMLDivElement>;

const items = "button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";
const moves: Record<string, (index: number, count: number) => number> = {
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  ArrowRight: (index, count) => (index + 1) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

/** A bar of actions that stays at the top of what scrolls beneath it. Put its buttons in `ToolbarGroup`s. */
export const Toolbar: ForwardRefExoticComponent<ToolbarProps & RefAttributes<HTMLDivElement>> = /* @__PURE__ */ forwardRef<
  HTMLDivElement,
  ToolbarProps
>(function Toolbar({ edge = "uniform", className, onKeyDown, ...props }, forwardedRef) {
  const ref = useRef<HTMLDivElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current!);

  useEffect(() => {
    const bar = ref.current;
    if (!bar || edge === "none") return;
    const box = scroller(bar);
    const target = box ?? window;
    const update = () => bar.toggleAttribute("data-scrolled", (box ? box.scrollTop : window.scrollY) > 0);
    update();
    target.addEventListener("scroll", update, { passive: true });
    return () => {
      target.removeEventListener("scroll", update);
      bar.removeAttribute("data-scrolled");
    };
  }, [edge]);

  // Arrow keys move between the bar's items; Tab leaves the bar as usual.
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const step = moves[event.key];
    const target = event.target as HTMLElement;
    if (event.defaultPrevented || !step || target.matches("input, textarea, select, [contenteditable]")) return;
    const all = [...event.currentTarget.querySelectorAll<HTMLElement>(items)];
    const index = all.indexOf(target);
    if (index < 0) return;
    event.preventDefault();
    all[step(index, all.length)]?.focus();
  };

  return (
    <div
      ref={ref}
      role="toolbar"
      className={cx("lg-toolbar", className)}
      data-edge={edge === "none" ? undefined : edge}
      onKeyDown={move}
      {...props}
    />
  );
});

/** Actions that share one piece of glass in a `Toolbar`. */
export const ToolbarGroup: ForwardRefExoticComponent<ToolbarGroupProps & RefAttributes<HTMLDivElement>> =
  /* @__PURE__ */ forwardRef<HTMLDivElement, ToolbarGroupProps>(function ToolbarGroup({ className, ...props }, forwardedRef) {
    const ref = useRef<HTMLDivElement>(null);
    useImperativeHandle(forwardedRef, () => ref.current!);
    useRefraction(ref);
    return <div ref={ref} role="group" className={cx("lg-glass lg-toolbar-group", className)} {...props} />;
  });
