import {
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
  type JSX,
  type ReactNode,
} from "react";

import { BEND_STEPS, bendFilters } from "./internal/bend";
import { createJelly, FLAT, type Squash } from "./internal/jelly";
import { useControllable } from "./internal/controllable";
import { cx } from "./internal/cx";
import { held } from "./internal/hold";
import { safeHref } from "./internal/href";
import { useRefraction } from "./internal/refraction";
import { createSpring, prefersReducedMotion } from "./internal/spring";
import { DRAG, REST } from "./internal/tab-motion";

export interface TabBarItem {
  value: string;
  label: ReactNode;
  /** Shown above the label, as in an iOS tab bar. */
  icon?: ReactNode;
  /** Renders the tab as a link. Clicking it navigates; the bar still tracks selection. */
  href?: string;
}

export interface TabBarProps extends Omit<HTMLAttributes<HTMLDivElement>, "defaultValue" | "onChange"> {
  items: TabBarItem[];
  /** The selected tab's `value`, or `null` for none. */
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string) => void;
  /** Shrinks the bar to the current tab's icon, as iOS does when a page scrolls down. */
  minimized?: boolean;
  /** Called when the minimised bar is tapped, to ask for it back. */
  onExpand?: () => void;
  /** The component used for tabs with an `href`, such as Next.js's `Link`. */
  link?: ElementType;
}

interface Parts {
  bar: HTMLElement;
  glass: HTMLElement;
  lens: HTMLElement;
  tint: HTMLElement;
  bend: HTMLElement;
  row: HTMLElement;
}

interface Controller {
  setActive(index: number): void;
  destroy(): void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
// A quick tap still lifts the lens and carries it across, as on iOS.
const LIFT_MS = 230;
// Under a finger the whole bar swells.
const BAR_GROW = 0.049;
const ZOOM = 0.19;
const PULL = 0.07;

function attach({ bar, glass, lens, tint, bend, row }: Parts, select: (index: number) => void): Controller {
  const tabs = [...bar.querySelectorAll<HTMLElement>(".lg-tab")];
  const faces = [...bar.querySelectorAll<HTMLElement>(".lg-tab-face")];
  const copies = [...row.children] as HTMLElement[];
  let slot = 0;
  let height = 0;
  let growX = 16;
  let growY = 12;
  let edge = 0;
  let top = 0;
  let lensWidth = 0;
  let bends: string[] = [];
  let active = -1;
  let shown = false;
  let settleFrame = 0;
  let linger = 0;
  let gesture: { id: number; x: number; anchor: number; moved: boolean; box: DOMRect; at: number } | null = null;
  const state = { x: 0, lift: 0 };
  let squashed: Squash = FLAT;

  const measure = () => {
    const style = getComputedStyle(bar);
    slot = (bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)) / tabs.length;
    height = lens.offsetHeight;
    edge = parseFloat(style.paddingLeft) || 0;
    top = parseFloat(style.paddingTop) || 0;
    lensWidth = lens.offsetWidth;
    growX = parseFloat(style.getPropertyValue("--lg-lens-grow-x")) || 0;
    growY = parseFloat(style.getPropertyValue("--lg-lens-grow-y")) || 0;
    // The lens's copy of the labels bends at its rim. Made before the first lift, so it's ready.
    const dark = style.getPropertyValue("--lg-dark").trim() !== "" && style.getPropertyValue("--lg-dark").trim() !== "initial";
    if (tint.offsetWidth && tint.offsetHeight) bends = bendFilters(tint.offsetWidth, tint.offsetHeight, dark);
  };

  // The selection shows its own copy of the tabs, so the ones under it are cut away along
  // its edge. Only the faces: a tab under the lens still has to take a touch.
  const cutOut = (x: number, sx: number, sy: number) => {
    const width = lensWidth * sx;
    const tall = height * sy;
    const left = edge + x + slot / 2 - width / 2;
    const up = top + height / 2 - tall / 2;
    const rx = Math.min((height / 2) * sx, width / 2);
    const ry = tall / 2;
    faces.forEach((face, index) => {
      const from = edge + index * slot;
      if ("hidden" in bar.dataset || left + width <= from || left >= from + slot) {
        face.style.clipPath = "";
        return;
      }
      const [l, r] = [left - from, left - from + width];
      const [t, b] = [up - top, up - top + tall];
      const n = (value: number) => value.toFixed(2);
      const hole = `M${n(l + rx)} ${n(t)}H${n(r - rx)}A${n(rx)} ${n(ry)} 0 0 1 ${n(r)} ${n((t + b) / 2)}A${n(rx)} ${n(ry)} 0 0 1 ${n(r - rx)} ${n(b)}H${n(l + rx)}A${n(rx)} ${n(ry)} 0 0 1 ${n(l)} ${n((t + b) / 2)}A${n(rx)} ${n(ry)} 0 0 1 ${n(l + rx)} ${n(t)}Z`;
      face.style.clipPath = `path(evenodd, "M-200 -200H${n(slot + 200)}V${n(height + 200)}H-200Z${hole}")`;
    });
  };

  const paint = () => {
    const { x, lift } = state;
    // The lens stretches along a drag, and thins across it, by how far it trails the finger.
    const sx = (1 + (growX / slot) * lift) * squashed.x;
    const sy = (1 + (growY / height) * lift) * squashed.y;
    lens.style.transform = tint.style.transform = `translateX(${x}px) scale(${sx}, ${sy})`;
    // Everything in the lens is enlarged as it lifts, each tab about its own centre, and
    // they draw in a little towards the lens's. Measured on iOS.
    const pull = 1 - PULL * lift;
    const zoom = (1 + ZOOM * lift) / pull;
    const centre = `${slot / 2}px, ${height / 2}px`;
    row.style.transform = `translate(${centre}) scale(${pull}) translate(-${slot / 2}px, -${height / 2}px) scale(${1 / sx}, ${1 / sy}) translate(${-x + ((sx - 1) * slot) / 2}px, ${((sy - 1) * height) / 2}px)`;
    for (const copy of copies) copy.style.scale = String(zoom);
    // The rim's bend grows with the lift, a step at a time: each step is its own filter,
    // as WebKit keeps drawing a filter's old output until it's given a new one.
    const step = Math.round(lift * BEND_STEPS);
    bend.style.filter = step > 0 ? (bends[Math.min(step, bends.length) - 1] ?? "") : "";
    bar.style.scale = lift > 0.001 ? String(1 + BAR_GROW * lift) : "";
    cutOut(x, sx, sy);
    if (!gesture && lift < 0.01) delete bar.dataset.refracting;
  };

  const jelly = createJelly(
    () => lensWidth || lens.offsetWidth,
    (shape) => {
      squashed = shape;
      paint();
    },
  );
  const x = createSpring(0, REST[0], REST[1], (value) => {
    state.x = value;
    jelly.follow(value);
    paint();
  });
  const lift = createSpring(0, REST[2], REST[3], (value) => {
    state.lift = value;
    paint();
  });

  const move = (target: number, lifted: boolean, instant = false) => {
    // The lens keeps up with a finger that's dragging it on a stiff spring. A tap, a key or a
    // change of tab carries it across on the looser one, which is what lets it swing past.
    const [slideStiffness, slideDamping] = gesture?.moved ? DRAG : REST;
    const [, , liftStiffness, liftDamping] = gesture ? DRAG : REST;
    x.tune(slideStiffness, slideDamping);
    lift.tune(liftStiffness, liftDamping);
    // A lens put straight in place has nothing trailing it.
    if (instant) jelly.follow(target, true);
    x.set(target, instant);
    lift.set(lifted ? 1 : 0, instant);
  };

  const settle = (instant = false) => {
    if (gesture) return;
    const show = active >= 0;
    if (show) delete bar.dataset.hidden;
    else bar.dataset.hidden = "";
    if (show) move(active * slot, linger !== 0, instant || !shown);
    else paint();
    shown = show;
  };

  const position = (event: PointerEvent) =>
    clamp(gesture!.anchor + event.clientX - gesture!.x, 0, slot * (tabs.length - 1));

  const light = (event: PointerEvent, box: DOMRect) => {
    glass.style.setProperty("--lg-x", `${clamp(((event.clientX - box.left) / box.width) * 100, 0, 100)}%`);
    lens.style.setProperty("--lg-x", `${clamp(((event.clientX - box.left - 4 - state.x) / slot) * 100, 0, 100)}%`);
  };

  const drop = () => {
    clearTimeout(linger);
    linger = 0;
    delete bar.dataset.lifted;
    delete lens.dataset.pressed;
  };

  const release = (keep = false) => {
    const old = gesture;
    gesture = null;
    drop();
    const left = keep && old && !prefersReducedMotion() ? LIFT_MS - (performance.now() - old.at) : 0;
    if (left > 0) {
      bar.dataset.lifted = "";
      lens.dataset.pressed = "";
      linger = window.setTimeout(() => {
        drop();
        settle();
      }, left);
    }
    if (old && bar.hasPointerCapture(old.id)) bar.releasePointerCapture(old.id);
    return old;
  };

  let suppressClick = false;

  const onPointerDown = (event: PointerEvent) => {
    const tab = (event.target as Element).closest<HTMLElement>(".lg-tab");
    if (!event.isPrimary || event.button !== 0 || gesture || !tab) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    cancelAnimationFrame(settleFrame);
    settleFrame = 0;
    drop();
    measure();
    const box = bar.getBoundingClientRect();
    gesture = {
      id: event.pointerId,
      x: event.clientX,
      anchor: tabs.indexOf(tab) * slot,
      moved: false,
      box,
      at: performance.now(),
    };
    suppressClick = false;
    bar.dataset.lifted = "";
    bar.dataset.refracting = "";
    delete bar.dataset.hidden;
    lens.dataset.pressed = "";
    light(event, box);
    move(gesture.anchor, true, !shown);
    shown = true;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== gesture?.id) return;
    if (!gesture.moved && Math.abs(event.clientX - gesture.x) > 6) {
      gesture.moved = true;
      bar.setPointerCapture(event.pointerId);
    }
    if (gesture.moved) move(position(event), true);
    light(event, gesture.box);
  };

  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId !== gesture?.id) return;
    // Touch implicitly captures the tab before a drag captures the bar. The
    // tab's bubbling capture-loss event is a handoff, not the end of the drag.
    if (event.type === "lostpointercapture" && event.target !== bar) return;
    const index = Math.round(position(event) / slot);
    const { moved, box } = gesture;
    // A drag selects wherever it leaves the lens, even released off the bar.
    // A tap only counts if it ends on the bar, as with a button.
    const near = event.clientY >= box.top - 24 && event.clientY <= box.bottom + 24;
    release(event.type === "pointerup" && !moved && near);
    if (event.type === "pointerup" && (moved || near)) {
      // Activate taps and drags at release, before settling. Waiting for the
      // browser's click briefly sends the lens back toward the old selection.
      suppressClick = true;
      // React may commit a controlled selection after the click handler. Use
      // its new value, or settle back if the consumer declines the change.
      settleFrame = requestAnimationFrame(() => {
        settleFrame = 0;
        settle();
      });
      tabs[index]?.click();
    } else {
      suppressClick = moved;
      settle();
    }
  };

  // A quick swipe that starts on the bar still scrolls the page, but a press
  // that has rested there, or a drag already under way, keeps the touch.
  const onTouchMove = (event: TouchEvent) => {
    if (gesture && event.cancelable && held(gesture.at, gesture.moved)) event.preventDefault();
  };

  const onClick = (event: MouseEvent) => {
    if (event.isTrusted && suppressClick && event.detail !== 0) {
      suppressClick = false;
      event.preventDefault();
      return;
    }
    const tab = (event.target as Element).closest<HTMLElement>(".lg-tab");
    if (!tab || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const index = tabs.indexOf(tab);
    if (tab instanceof HTMLAnchorElement) {
      active = index;
      settle();
    }
    select(index);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const tab = (event.target as Element).closest<HTMLElement>(".lg-tab");
    if (!tab || tab instanceof HTMLAnchorElement || !keys.includes(event.key)) return;
    event.preventDefault();
    const current = tabs.indexOf(tab);
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
    select(index);
    tabs[index]?.focus();
  };

  const reset = () => {
    cancelAnimationFrame(settleFrame);
    settleFrame = 0;
    release();
    settle(true);
  };
  const onVisibilityChange = () => {
    if (document.hidden) reset();
  };
  const observer = new ResizeObserver(() => {
    measure();
    if (!gesture) settle(true);
  });

  measure();
  bar.dataset.ready = "";
  bar.addEventListener("pointerdown", onPointerDown);
  // A mouse isn't captured until it has moved, so follow it past the bar.
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerEnd);
  window.addEventListener("pointercancel", onPointerEnd);
  bar.addEventListener("lostpointercapture", onPointerEnd);
  bar.addEventListener("touchmove", onTouchMove, { passive: false });
  bar.addEventListener("click", onClick, true);
  bar.addEventListener("keydown", onKeyDown);
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("blur", reset);
  observer.observe(bar);

  return {
    setActive(index) {
      cancelAnimationFrame(settleFrame);
      settleFrame = 0;
      active = index;
      settle();
    },
    destroy() {
      clearTimeout(linger);
      bar.style.scale = "";
      cancelAnimationFrame(settleFrame);
      x.stop();
      lift.stop();
      jelly.stop();
      observer.disconnect();
      for (const key of ["ready", "hidden", "lifted", "refracting"]) delete bar.dataset[key];
      bar.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      bar.removeEventListener("lostpointercapture", onPointerEnd);
      bar.removeEventListener("touchmove", onTouchMove);
      bar.removeEventListener("click", onClick, true);
      bar.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", reset);
    },
  };
}

export function TabBar({
  items,
  value: valueProp,
  defaultValue = null,
  onValueChange,
  minimized = false,
  onExpand,
  link: Link = "a",
  className,
  style,
  ...props
}: TabBarProps): JSX.Element {
  const barRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLSpanElement>(null);
  const lensRef = useRef<HTMLSpanElement>(null);
  const tintRef = useRef<HTMLSpanElement>(null);
  const rowRef = useRef<HTMLSpanElement>(null);
  const bendRef = useRef<HTMLSpanElement>(null);
  const controller = useRef<Controller | null>(null);
  const [value, setValue] = useControllable<string | null, string>(valueProp, defaultValue, onValueChange);
  const selected = items.findIndex((item) => item.value === value);
  const latest = useRef({ items, selected, setValue });
  const signature = items.map((item) => item.value).join("\n");
  const navigation = items.every((item) => safeHref(item.href) !== undefined);
  const face = (item: TabBarItem) =>
    item.icon == null ? (
      item.label
    ) : (
      <>
        <span className="lg-tab-icon">{item.icon}</span>
        {item.label}
      </>
    );

  useRefraction(glassRef);
  useRefraction(lensRef, true);

  useEffect(() => {
    latest.current = { items, selected, setValue };
  });

  useEffect(() => {
    const instance = attach(
      { bar: barRef.current!, glass: glassRef.current!, lens: lensRef.current!, tint: tintRef.current!, bend: bendRef.current!, row: rowRef.current! },
      (index) => {
        const item = latest.current.items[index];
        if (item) latest.current.setValue(item.value);
      },
    );
    instance.setActive(latest.current.selected);
    controller.current = instance;
    return () => {
      instance.destroy();
      controller.current = null;
    };
  }, [signature]);

  useLayoutEffect(() => {
    controller.current?.setActive(selected);
  }, [selected]);

  return (
    <div
      ref={barRef}
      role={navigation ? "navigation" : "tablist"}
      className={cx("lg-tab-bar", className)}
      data-icons={items.some((item) => item.icon != null) ? "" : undefined}
      data-minimized={minimized ? "" : undefined}
      style={{ ...style, "--lg-index": Math.max(selected, 0), "--lg-tabs": items.length } as CSSProperties}
      {...props}
    >
      <span ref={glassRef} className="lg-glass lg-tab-bar-glass" aria-hidden />
      {items.map((item, index) =>
        safeHref(item.href) !== undefined ? (
          <Link
            key={item.value}
            href={safeHref(item.href)!}
            className="lg-tab"
            data-selected={index === selected ? "" : undefined}
            aria-current={index === selected ? "page" : undefined}
            draggable={false}
          >
            <span className="lg-tab-face">{face(item)}</span>
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            role="tab"
            className="lg-tab"
            data-selected={index === selected ? "" : undefined}
            aria-selected={index === selected}
            tabIndex={index === selected || (selected < 0 && index === 0) ? 0 : -1}
          >
            <span className="lg-tab-face">{face(item)}</span>
          </button>
        ),
      )}
      <span ref={tintRef} className="lg-tab-tint" aria-hidden>
        <span ref={bendRef} className="lg-tab-bend">
          <span className="lg-tab-clip">
            <span ref={rowRef} className="lg-tab-row">
              {items.map((item) => (
                <span key={item.value} className="lg-tab-copy">
                  {face(item)}
                </span>
              ))}
            </span>
          </span>
        </span>
      </span>
      <span ref={lensRef} className="lg-glass lg-tab-lens" aria-hidden />
      {items[selected]?.icon == null ? null : (
        <button type="button" className="lg-tab-mini" aria-label="Show tabs" tabIndex={minimized ? 0 : -1} aria-hidden={!minimized} onClick={onExpand}>
          <span className="lg-tab-icon">{items[selected]!.icon}</span>
        </button>
      )}
    </div>
  );
}
