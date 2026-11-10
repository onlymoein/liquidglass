import { createSpring } from "./spring";

// Glass that's dragged along isn't rigid. The lens trails the finger, so it stretches in the
// direction it's going and thins across it, by more the faster it's taken: a slow drag leaves
// it as it was, and a quick one pulls it out. When the finger stops it swings back past its
// own shape once or twice and settles, which is what gives a held lens its weight.
//
// The lens follows the place it's been taken to on a loose spring, and the shape comes from
// how far behind that place it is. Chosen by eye from the feel of iOS, not measured.

// Swings back about a fifth of the way past, once: 650 / 24 is a damping ratio of 0.47.
const STIFFNESS = 650;
const DAMPING = 24;
/** The most a lens stretches along its drag, as a share of its length. */
const STRETCH = 0.3;
/** How far behind it has to trail, in lengths, to be most of the way there. */
const REACH = 1.2;
/** How much it thins across for what it stretches along. */
const THIN = 0.55;

export interface Squash {
  /** Scale along the drag. */
  x: number;
  /** Scale across it. */
  y: number;
  /** How far the body trails the place it was taken to, in px, negative behind it. */
  shift: number;
}

export const FLAT: Squash = { x: 1, y: 1, shift: 0 };

/** The shape of a lens `length` long that trails its place by `lag` px, as far as `trail` of it shows. */
export function squash(lag: number, length: number, trail = 0): Squash {
  if (!lag || length <= 0) return FLAT;
  const amount = STRETCH * Math.tanh(Math.abs(lag) / (length * REACH));
  // Under a hundredth of a pixel there's nothing to see, and the lens may as well rest.
  if (amount < 1e-4) return FLAT;
  return { x: 1 + amount, y: 1 - THIN * amount, shift: -lag * trail };
}

export interface Jelly {
  /** Takes the lens to a place along its drag. `instant` puts it there with nothing trailing. */
  follow(position: number, instant?: boolean): void;
  stop(): void;
}

/**
 * Follows a lens's place and reports its shape each frame it changes. `trail` is how much
 * of the lag the body itself shows, for a lens that's moved straight to the finger: one
 * already carried on a spring of its own trails enough by itself, and passes 0.
 */
export function createJelly(length: () => number, paint: (shape: Squash) => void, trail = 0): Jelly {
  let place = 0;
  let seeded = false;
  let last: Squash = FLAT;
  const spring = createSpring(0, STIFFNESS, DAMPING, (at) => {
    const next = squash(place - at, length(), trail);
    if (next.x === last.x && next.y === last.y && next.shift === last.shift) return;
    last = next;
    paint(next);
  });
  return {
    follow(position, instant = false) {
      place = position;
      // With nothing yet to trail from, the first place is where it starts.
      const jump = instant || !seeded;
      seeded = true;
      spring.set(position, jump);
    },
    stop: () => spring.stop(),
  };
}
