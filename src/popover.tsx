import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";

import { Button, type ButtonProps } from "./button";
import { hideFromTopLayer, showInTopLayer, triggerRect, viewport } from "./internal/anchor";
import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { reducedMotion } from "./internal/modal";
import { ARROW, placePopover } from "./internal/placement";
import { fitLens, fitRim } from "./internal/refraction";
import { useStyles } from "./internal/styles";
import buttonCss from "./styles/button.css?inline";
import popoverCss from "./styles/popover.css?inline";

export interface PopoverProps {
  /** What the popover holds: text, controls, a small form. */
  children: ReactNode;
  /** Names the popover for assistive technology, and the trigger too when it has no `label`. */
  "aria-label": string;
  /** The trigger's icon. */
  icon?: ReactNode;
  /** Turns the trigger into a pill with this label. */
  label?: ReactNode;
  /** Anything else for the trigger button, such as its `variant` or `className`. */
  trigger?: Omit<ButtonProps, "icon" | "children" | "onClick">;
  /**
   * The side of the trigger it opens on. `auto` is below, and above when there isn't room; a
   * side that doesn't fit gives way to the other one.
   */
  side?: "auto" | "bottom" | "top";
  /** The trigger edge it lines up with. */
  align?: "start" | "center" | "end";
  /** Draws the arrow that points at the trigger, as iOS does. Without one, the popover just floats beside it. */
  arrow?: boolean;
  /** Whether the popover is open. Pass it with `onOpenChange` to open and close it yourself. */
  open?: boolean;
  defaultOpen?: boolean;
  /** Called when the trigger, Escape, Tab, a press outside or focus leaving asks to open or close the popover. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

type Phase = "closed" | "open" | "leaving";

/** How long the popover takes to leave, before it's taken off the page. */
const LEAVE_MS = 180;

/** How long the opening takes to settle, after which the glass can bend what's behind it. */
const SETTLE_MS = 650;

// The popover is measured and placed before it's first painted.
const useLayout = typeof window === "undefined" ? useEffect : useLayoutEffect;

// An arrow's outline in a box ARROW.width wide and ARROW.height + 1 tall, pointing up, with a
// round tip. It runs a point into the popover so no seam shows where they meet.
const W = ARROW.width;
const H = ARROW.height + 1;
const ARROW_PATH = `M0 ${H} C${W * 0.19} ${H} ${W * 0.31} ${H - 2.2} ${W * 0.4} ${H - 5.6} C${W * 0.45} ${H - 8.6} ${W * 0.55} ${H - 8.6} ${W * 0.6} ${H - 5.6} C${W * 0.69} ${H - 2.2} ${W * 0.81} ${H} ${W} ${H} Z`;
// What's stroked along its two slanted sides: the rim, which is left off the base.
const ARROW_RIM = `M0 ${H} C${W * 0.19} ${H} ${W * 0.31} ${H - 2.2} ${W * 0.4} ${H - 5.6} C${W * 0.45} ${H - 8.6} ${W * 0.55} ${H - 8.6} ${W * 0.6} ${H - 5.6} C${W * 0.69} ${H - 2.2} ${W * 0.81} ${H} ${W} ${H}`;

const focusable = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * The iOS popover: a card of glass with an arrow, which opens out of its trigger and holds
 * whatever you put in it. It is not modal. Escape, a press outside, or moving focus away
 * closes it.
 */
export function Popover({
  children,
  "aria-label": name,
  icon,
  label,
  trigger,
  side = "auto",
  align = "center",
  arrow = true,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  style,
}: PopoverProps): JSX.Element {
  useStyles(["button", buttonCss], ["popover", popoverCss]);
  const [open, setOpen] = useControllable(openProp, defaultOpen, onOpenChange);
  const id = useId();
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ open, setOpen, side, align, arrow });
  const refocus = useRef(true);
  const replace = useRef<(() => void) | null>(null);
  // Whether it was opened with a pointer, which has no use for a ring on its first control.
  const pointed = useRef(false);
  const mounted = phase !== "closed";

  // Before the layout effects below, which read it as they place the popover.
  useLayout(() => {
    latest.current = { open, setOpen, side, align, arrow };
  });

  useEffect(() => {
    if (open) return setPhase("open");
    setPhase((current) => (current === "closed" ? current : "leaving"));
    // Focus left inside the popover would be lost as it goes.
    if (refocus.current && cardRef.current?.contains(document.activeElement)) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    refocus.current = true;
  }, [open]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const timer = setTimeout(() => setPhase("closed"), reducedMotion() ? 0 : LEAVE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  useLayout(() => {
    if (!mounted) return;
    const trigger = triggerRef.current!;
    const card = cardRef.current!;
    const surface = surfaceRef.current!;
    const content = contentRef.current!;

    showInTopLayer(card);

    // Measured at its own size, then set beside the trigger, with its arrow pointing at it.
    const place = () => {
      const { side, align, arrow } = latest.current;
      content.style.maxHeight = "";
      delete card.dataset.scrolls;
      card.style.left = "0px";
      card.style.top = "0px";
      const size = { width: card.offsetWidth, height: card.offsetHeight };
      const corner = parseFloat(getComputedStyle(surface).borderTopLeftRadius) || undefined;
      const start = triggerRect(trigger);
      const at = placePopover(start, size, { side, align, arrow, corner }, viewport());
      card.dataset.side = at.side;
      if (at.scrolls) {
        card.dataset.scrolls = "";
        content.style.maxHeight = `${at.height}px`;
      }
      card.style.left = `${at.left}px`;
      card.style.top = `${at.top}px`;
      if (at.arrow === null) card.style.removeProperty("--lg-popover-arrow");
      else card.style.setProperty("--lg-popover-arrow", `${at.arrow}px`);
      // It opens out of the arrow's tip, or the trigger's edge where it has none.
      const x = at.arrow ?? Math.max(0, Math.min(size.width, start.left + start.width / 2 - at.left));
      card.style.transformOrigin = `${x}px ${at.side === "bottom" ? -at.distance : at.height + at.distance}px`;
      return size;
    };
    let size = place();

    // The rim is drawn at once; the glass bends what's behind it once it has settled, and is
    // taken back for as long as the popover is changing size.
    const stopRim = fitRim(surface);
    let stopLens: (() => void) | undefined;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const bend = (after: number) => {
      stopLens?.();
      stopLens = undefined;
      clearTimeout(settle);
      settle = setTimeout(() => {
        stopLens = fitLens(surface);
      }, after);
    };
    bend(reducedMotion() ? 0 : SETTLE_MS);

    if (!pointed.current) {
      // A keyboard starts on the first control. A finger has no use for it, and it'd come up ringed.
      const first = content.querySelector<HTMLElement>(focusable);
      if (first) first.focus({ preventScroll: true });
      else card.focus({ preventScroll: true });
    } else card.focus({ preventScroll: true });

    // It stays beside its trigger as the page scrolls or the window changes size, and as its
    // content grows or shrinks.
    const follow = (event?: Event) => {
      if (event?.target instanceof Node && card.contains(event.target)) return;
      const before = size;
      size = place();
      if (size.width !== before.width || size.height !== before.height) bend(150);
    };
    const resized = new ResizeObserver(() => follow());
    resized.observe(content);
    replace.current = () => follow();

    // Asks to close. A controlled popover stays open until its owner agrees.
    const close = (restoreFocus = true) => {
      if (!latest.current.open) return;
      refocus.current = restoreFocus;
      latest.current.setOpen(false);
    };

    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // The popover takes the Escape, so a dialog it opened over stays open.
      event.preventDefault();
      event.stopPropagation();
      close();
    };

    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!card.contains(target) && !trigger.contains(target)) close(false);
    };

    // Tabbing out of it closes it where focus has gone. Focus going to the trigger leaves it
    // be: the click that comes with it toggles it, and would open it again.
    const leaving = (event: FocusEvent) => {
      const next = event.relatedTarget as Node | null;
      if (next && !card.contains(next) && !trigger.contains(next)) close(false);
    };

    card.addEventListener("keydown", key);
    card.addEventListener("focusout", leaving);
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      clearTimeout(settle);
      stopLens?.();
      stopRim();
      resized.disconnect();
      replace.current = null;
      card.removeEventListener("keydown", key);
      card.removeEventListener("focusout", leaving);
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
      hideFromTopLayer(card);
    };
  }, [mounted]);

  // Staying beside the trigger as the side, alignment or arrow are changed while it's open.
  useLayout(() => {
    replace.current?.();
  }, [side, align, arrow]);

  return (
    <div className={cx("lg-popover", className)} style={style}>
      <Button
        {...trigger}
        ref={triggerRef}
        icon={icon}
        aria-label={trigger?.["aria-label"] ?? (label == null ? name : undefined)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={mounted ? id : undefined}
        onPointerDown={(event) => {
          trigger?.onPointerDown?.(event);
          pointed.current = true;
        }}
        onClick={(event) => {
          // A click without a pointer is the keyboard's.
          if (event.detail === 0) pointed.current = false;
          setOpen(!open);
        }}
      >
        {label}
      </Button>
      {mounted ? (
        <div
          ref={cardRef}
          id={id}
          role="dialog"
          tabIndex={-1}
          aria-label={name}
          className="lg-popover-card"
          data-phase={phase}
          data-arrow={arrow ? "" : undefined}
        >
          <span ref={surfaceRef} className="lg-glass lg-popover-surface" data-size-fixed aria-hidden />
          {arrow ? (
            <>
              <span className="lg-glass lg-popover-arrow" data-size-fixed aria-hidden style={{ clipPath: `path("${ARROW_PATH}")` }} />
              <svg className="lg-popover-arrow-rim" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden>
                <path d={ARROW_RIM} />
              </svg>
            </>
          ) : null}
          <div ref={contentRef} className="lg-popover-content">
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
