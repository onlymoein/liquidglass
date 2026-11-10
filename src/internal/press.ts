import { useEffect, type RefObject } from "react";

import { lightRim } from "./refraction";
import { createSpring } from "./spring";

interface Feel {
  /** How many pixels the longer side grows while pressed. */
  grow: number;
  press: readonly [number, number];
  release: readonly [number, number];
}

// A mouse press stays subtle.
const POINTER: Feel = { grow: 6, press: [417.6, 29.2], release: [230, 23.7] };
// A finger gets the iOS 27 glass button: it grows until its longer side is about
// 16pt bigger, and bounces back past its resting size on release. Fitted to
// recordings in parity/.
const TOUCH: Feel = { grow: 16, press: [795, 38], release: [342, 13.5] };

/**
 * What a press moves: a button sharing a toolbar group's glass moves the whole
 * group, icons and all, as iOS does. A filled button keeps its own glass.
 */
const glassOf = (el: HTMLElement): HTMLElement => {
  const group = el.parentElement;
  return group?.classList.contains("lg-toolbar-group") && el.dataset.variant !== "filled" ? group : el;
};

export function usePress(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const value = [1, 1, 0, 0];
    let glass = el;
    const paint = () => {
      glass.style.scale = `${value[0]} ${value[1]}`;
      glass.style.translate = `${value[2]}px ${value[3]}px`;
    };
    const springs = value.map((initial, i) =>
      createSpring(initial, ...POINTER.release, (next) => {
        value[i] = next;
        paint();
      }),
    );

    let pointer: { id: number; x: number; y: number; box: DOMRect; feel: Feel } | null = null;

    const target = (next: number[], [stiffness, damping]: readonly [number, number]) => {
      springs.forEach((spring, i) => {
        spring.tune(stiffness, damping);
        spring.set(next[i] ?? 0);
      });
    };

    const track = (event: PointerEvent) => {
      if (!pointer) return;
      const { box, feel } = pointer;
      glass.style.setProperty("--lg-x", `${((event.clientX - box.left) / box.width) * 100}%`);
      glass.style.setProperty("--lg-y", `${((event.clientY - box.top) / box.height) * 100}%`);

      const { width, height } = box;
      const base = 1 + feel.grow / Math.max(width, height);
      const aspect = width / height;
      const dx = (event.clientX - pointer.x) / aspect;
      const dy = event.clientY - pointer.y;
      const length = Math.hypot(dx, dy);
      if (!length) return target([base, base, 0, 0], feel.press);

      const nx = dx / length;
      const ny = dy / length;
      const rubber = 1 - 1 / (1 + length / height / (5 * aspect));
      const stretch = 1 + (6 / height) * rubber * Math.abs(Math.abs(nx) - Math.abs(ny));
      const horizontal = Math.abs(nx) > Math.abs(ny);
      target(
        [
          base * (horizontal ? stretch : 1 / stretch),
          base * (horizontal ? 1 / stretch : stretch),
          nx * 8 * rubber,
          ny * 8 * rubber,
        ],
        feel.press,
      );
    };

    const move = (event: PointerEvent) => {
      if (event.pointerId === pointer?.id) track(event);
    };

    const end = (event?: PointerEvent) => {
      if (event && event.pointerId !== pointer?.id) return;
      const feel = pointer?.feel ?? POINTER;
      pointer = null;
      delete el.dataset.pressed;
      if (glass !== el) delete glass.dataset.pressed;
      lightRim(glass, false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      target([1, 1, 0, 0], feel.release);
    };

    const down = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || pointer || el.matches(":disabled")) return;
      // Settle wherever the last press left off before moving something else.
      const next = glassOf(el);
      if (next !== glass) {
        glass.style.removeProperty("scale");
        glass.style.removeProperty("translate");
        glass = next;
      }
      pointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        box: glass.getBoundingClientRect(),
        feel: event.pointerType === "mouse" ? POINTER : TOUCH,
      };
      el.dataset.pressed = "";
      glass.dataset.pressed = "";
      lightRim(glass, true);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      track(event);
    };

    const reset = () => end();

    el.addEventListener("pointerdown", down);
    window.addEventListener("blur", reset);
    return () => {
      end();
      springs.forEach((spring) => spring.stop());
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("blur", reset);
      glass.style.removeProperty("scale");
      glass.style.removeProperty("translate");
    };
  }, [ref]);
}
