/**
 * Everything glass works out a pixel at a time: the maps its lens bends by, the picture of its
 * rim, the mask for continuous corners, and the tab lens's bend. It's one function with nothing
 * from outside it, so it can be sent to a worker as it is, and run there, off the page's thread.
 * The page runs it itself only where a worker can't, such as under a strict security policy.
 */
/** An image as its pixels: four bytes each, red, green, blue and alpha. */
export interface PaintImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** What each kind of painting gives back. */
export interface Paint {
  images: PaintImage[];
  maximum?: number;
  reach?: number;
}

export interface Painter {
  displacement(
    width: number,
    height: number,
    radius: number,
    selection: boolean,
    bezel: number | undefined,
    thickness: number | undefined,
    zoom: number,
    density: number,
  ): Paint;
  mask(width: number, height: number, radius: number, density: number): Paint;
  rim(width: number, height: number, radius: number, shine: number, clear: number, density: number, lens?: boolean): Paint;
  bend(width: number, height: number, density: number): Paint;
  continuous(width: number, height: number, radius: number): boolean;
  CORNER_REACH: number;
  CORNER_POWER: number;
  RIM_OUTSET: number;
  MASK_OUTSET: number;
}

// Types are gone by the time it runs, so the painter can name these and still bring nothing in.
export function painter(): Painter {
  // iOS's corners are continuous: the curve starts further along the edge than a circle's
  // would and passes through the same point at 45 degrees. This superellipse follows
  // alerts, sheets, menus and panels to about a quarter of a point. A corner this long
  // needs room, so anything nearly a capsule stays circular, as it does on iOS.
  const CORNER_REACH = 1.2;
  const CORNER_POWER = 2.5;
  // How far past the shape the rim's image reaches, for the hairline iOS draws just outside it.
  const RIM_OUTSET = 1;
  // How far outside the box the shape's mask reaches, to leave its shadow alone.
  const MASK_OUTSET = 44;
  /** How wide the band round a tab lens's rim that bends is, in px. */
  const BEND_BAND = 15;

  type Image = PaintImage;

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const continuous = (width: number, height: number, radius: number) => radius > 0 && radius * CORNER_REACH <= Math.min(width, height) / 2;
  const image = (width: number, height: number): Image => ({ width, height, data: new Uint8ClampedArray(width * height * 4) });

  /** Fills an image with one colour: what a map holds wherever it doesn't bend. */
  function flat(target: Image, r: number, g: number, b: number, a: number) {
    const { data } = target;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }

  /**
   * Visits only the pixels within `band` px of a rounded rectangle's edge, which is all that a
   * map changes in: whole rows down the top and bottom, as far as the corners reach, and just
   * the two ends of every row between.
   */
  function rimPixels(columns: number, rows: number, density: number, band: number, radius: number, visit: (x: number, y: number) => void) {
    const deep = Math.ceil((Math.max(band, radius) + 1) * density);
    const side = Math.ceil((band + 1) * density);
    for (let y = 0; y < rows; y++) {
      if (y < deep || y >= rows - deep || side * 2 >= columns) {
        for (let x = 0; x < columns; x++) visit(x, y);
      } else {
        for (let x = 0; x < side; x++) visit(x, y);
        for (let x = columns - side; x < columns; x++) visit(x, y);
      }
    }
  }

  function profile(bezel: number, thickness: number): { samples: Float32Array; maximum: number } {
    const samples = new Float32Array(128);
    let maximum = 0;
    for (let i = 0; i < samples.length; i++) {
      const t = Math.max(0.001, i / (samples.length - 1));
      const surface = (1 - (1 - t) ** 4) ** 0.25;
      const incident = Math.atan((1 - t) ** 3 / surface ** 3);
      const refracted = Math.asin(Math.sin(incident) / 1.5);
      samples[i] = Math.tan(incident - refracted) * (thickness + surface * bezel);
      maximum = Math.max(maximum, samples[i]!);
    }
    return { samples, maximum };
  }

  // How far iOS 27 glass moves its backdrop inward: a third of its height at the
  // very edge, falling in a straight line to nothing across the bezel. Measured
  // on panels and pills in parity/.
  function rimProfile(reach: number): { samples: Float32Array; maximum: number } {
    const samples = new Float32Array(128);
    for (let i = 0; i < samples.length; i++) samples[i] = reach * (1 - i / (samples.length - 1));
    return { samples, maximum: reach };
  }

  /** How far inside a rounded rectangle a point is, measured from its centre, and which way is out. */
  function toEdge(px: number, py: number, width: number, height: number, radius: number): { distance: number; nx: number; ny: number } {
    if (continuous(width, height, radius)) {
      const reach = radius * CORNER_REACH;
      const a = Math.abs(px) - (width / 2 - reach);
      const b = Math.abs(py) - (height / 2 - reach);
      if (a > 0 && b > 0) {
        const [u, v] = [a / reach, b / reach];
        const g = (u ** CORNER_POWER + v ** CORNER_POWER) ** (1 / CORNER_POWER);
        const gx = (u / g) ** (CORNER_POWER - 1);
        const gy = (v / g) ** (CORNER_POWER - 1);
        const norm = Math.hypot(gx, gy);
        return { distance: ((1 - g) * reach) / norm, nx: (gx / norm) * Math.sign(px), ny: (gy / norm) * Math.sign(py) };
      }
      const dx = width / 2 - Math.abs(px);
      const dy = height / 2 - Math.abs(py);
      return dx < dy ? { distance: dx, nx: Math.sign(px), ny: 0 } : { distance: dy, nx: 0, ny: Math.sign(py) };
    }
    const qx = Math.abs(px) - (width / 2 - radius);
    const qy = Math.abs(py) - (height / 2 - radius);
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    const length = Math.hypot(ox, oy);
    return {
      distance: radius - (length + Math.min(Math.max(qx, qy), 0)),
      nx: length > 0 ? (ox / length) * Math.sign(px) : qx > qy ? Math.sign(px) : 0,
      ny: length > 0 ? (oy / length) * Math.sign(py) : qx > qy ? 0 : Math.sign(py),
    };
  }

  /**
   * The lens's maps: how far each point moves what's behind it, and for a lens that enlarges, a
   * second map that does that. Only the bezel bends, so everywhere within it stays the flat grey
   * that moves nothing, and only the band round the edge is worked out.
   */
  function displacement(
    width: number,
    height: number,
    radius: number,
    selection: boolean,
    bezelGiven: number | undefined,
    thicknessGiven: number | undefined,
    zoom: number,
    density: number,
  ): Paint {
    const short = Math.min(width, height);
    const bezel = bezelGiven ?? (selection ? clamp(short * 0.12, 4, 10) : clamp(2.4 + short * 0.059, 3, 12));
    const { samples, maximum } = selection ? profile(bezel, thicknessGiven ?? clamp(short * 0.2, 8, 24)) : rimProfile(thicknessGiven ?? Math.min(short * 0.33, 48));
    const columns = Math.ceil(width * density);
    const rows = Math.ceil(height * density);
    const field = image(columns, rows);
    const magnify = zoom > 1 ? image(columns, rows) : undefined;
    const reach = Math.max(width, height) / 2;
    const direction = selection ? 1 : -1;

    const point = (x: number, y: number) => {
      const px = ((x + 0.5) * width) / columns - width / 2;
      const py = ((y + 0.5) * height) / rows - height / 2;
      // The same edge the glass is cut to, continuous corners and all, so the bend hugs it.
      const edge = toEdge(px, py, width, height, radius);
      const { nx, ny } = edge;
      // A pixel whose centre is just past the edge still shows inside it where the edge
      // crosses it, so it bends as the edge does. Left flat, a curve shows steps a pixel tall.
      const distance = Math.max(0, edge.distance);

      let shift = 0;
      if (distance < bezel) {
        const sample = (distance / bezel) * (samples.length - 1);
        const lower = Math.floor(sample);
        const a = samples[lower]!;
        const b = samples[Math.min(lower + 1, samples.length - 1)]!;
        shift = a + (b - a) * (sample - lower);
      }

      const i = (y * columns + x) * 4;
      field.data[i] = Math.round(127.5 + ((direction * nx * shift) / maximum) * 127.5);
      field.data[i + 1] = Math.round(127.5 + ((direction * ny * shift) / maximum) * 127.5);
      field.data[i + 2] = 128;
      field.data[i + 3] = 255;

      // A linear field: each point samples from closer to the centre, which
      // enlarges the whole face evenly.
      if (magnify) {
        magnify.data[i] = Math.round(127.5 - (px / reach) * 127.5);
        magnify.data[i + 1] = Math.round(127.5 - (py / reach) * 127.5);
        magnify.data[i + 2] = 128;
        magnify.data[i + 3] = 255;
      }
    };

    if (magnify) {
      // The enlarging map changes everywhere, so every pixel is worked out.
      for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) point(x, y);
    } else {
      flat(field, 128, 128, 128, 255);
      rimPixels(columns, rows, density, bezel, continuous(width, height, radius) ? radius * CORNER_REACH : radius, point);
    }
    return { images: magnify ? [field, magnify] : [field], maximum, reach };
  }

  // CSS only draws circular corners, but a mask keeps the backdrop where a clip doesn't. It
  // trims the circle down to the continuous curve, smoothed across one of the screen's pixels,
  // and leaves everything outside the circle as it was: only the shadow is out there.
  function mask(width: number, height: number, radius: number, density: number): Paint {
    const result = image(Math.ceil((width + MASK_OUTSET * 2) * density), Math.ceil((height + MASK_OUTSET * 2) * density));
    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        const px = (x + 0.5) / density - MASK_OUTSET - width / 2;
        const py = (y + 0.5) / density - MASK_OUTSET - height / 2;
        const qx = Math.abs(px) - (width / 2 - radius);
        const qy = Math.abs(py) - (height / 2 - radius);
        const outsideCircle = qx > 0 && qy > 0 ? Math.hypot(qx, qy) > radius : qx > radius || qy > radius;
        // A point past the rim's hairline is cut; the hairline itself has to stay.
        const alpha = outsideCircle ? 1 : clamp((toEdge(px, py, width, height, radius).distance + RIM_OUTSET) * density + 0.5, 0, 1);
        result.data[(y * result.width + x) * 4 + 3] = Math.round(alpha * 255);
      }
    }
    return { images: [result] };
  }

  /**
   * Draws a rim from how light and how shaded it is at each distance from the edge, out to
   * `reach` inside it. Its lines are a point wide or less, finer than a pixel on most screens,
   * so each pixel is the average of a grid of points across it rather than its centre alone,
   * and lines and curves come out smooth instead of dotted and stepped.
   */
  function drawRim(
    width: number,
    height: number,
    radius: number,
    density: number,
    reach: number,
    at: (distance: number, nx: number, ny: number) => [light: number, shade: number],
  ): Paint {
    const result = image(Math.ceil((width + RIM_OUTSET * 2) * density), Math.ceil((height + RIM_OUTSET * 2) * density));
    // Four points a CSS pixel each way on an ordinary screen, two on a sharp one; a phone's
    // pixels are already finer than the lines.
    const grid = density >= 3 ? 1 : density >= 2 ? 2 : 4;
    const step = 1 / (grid * density);
    // How far a pixel's own points can be from its centre.
    const spread = 0.75 / density;
    for (let y = 0; y < result.height; y++) {
      for (let x = 0; x < result.width; x++) {
        const cx = (x + 0.5) / density - RIM_OUTSET - width / 2;
        const cy = (y + 0.5) / density - RIM_OUTSET - height / 2;
        const centre = toEdge(cx, cy, width, height, radius);
        if (centre.distance > reach + spread || centre.distance < -RIM_OUTSET - spread) continue;
        // The lines are all within a point or so of the edge. Further in, the rim changes
        // slowly enough that a pixel's centre speaks for all of it.
        const fine = grid > 1 && centre.distance < 2 + spread;
        const across = fine ? grid : 1;
        let alpha = 0;
        let white = 0;
        for (let j = 0; j < across; j++) {
          for (let k = 0; k < across; k++) {
            const { distance, nx, ny } = fine
              ? toEdge(x / density + (k + 0.5) * step - RIM_OUTSET - width / 2, y / density + (j + 0.5) * step - RIM_OUTSET - height / 2, width, height, radius)
              : centre;
            if (distance > reach) continue;
            const [light, shade] = at(distance, nx, ny);
            const covered = light + shade - light * shade;
            alpha += covered;
            // Premultiplied, so a point with nothing on it doesn't grey its neighbours.
            if (covered > 0) white += (light / (light + shade)) * covered;
          }
        }
        if (alpha <= 0) continue;
        const i = (y * result.width + x) * 4;
        result.data[i] = result.data[i + 1] = result.data[i + 2] = Math.round((255 * white) / alpha);
        result.data[i + 3] = Math.round((alpha / (across * across)) * 255);
      }
    }
    return { images: [result] };
  }

  // iOS 27 lights glass from straight above and below: a bright line along the top
  // and bottom, a dark hairline just outside the sides and more faintly round the
  // rest, and a faint shade inside everywhere but the bottom. Measured in parity/.
  function rim(width: number, height: number, radius: number, shine: number, clear: number, density: number, lens = false): Paint {
    if (lens) return lensRim(width, height, radius, shine, density);
    return drawRim(width, height, radius, density, 15, (distance, nx, ny) => {
      const side = nx * nx;
      const end = ny * ny;
      let light = 0;
      let shade = 0;
      if (distance >= 0) {
        const line = Math.max(0, 0.39 - 0.29 * distance);
        if (ny < 0) {
          light = end * (line + (distance > 1 ? 0.05 * Math.max(0, 1 - (distance - 1) / 2.5) : 0));
          shade = end * 0.02 * Math.max(0, 1 - Math.abs(distance - 9) / 5);
        } else if (ny > 0) {
          light = end * line;
        }
        shade += side * 0.02 * clamp((15 - distance) / 5, 0, 1);
      } else {
        const outside = clamp(1 + distance / 0.75, 0, 1);
        shade = (side * 0.75 + end * 0.2) * outside;
      }
      // Clear glass has nothing lifting it, so its lit edge stands out more.
      return [clamp(light * shine * (1 + clear * 1.1), 0, 1), clamp(shade * shine, 0, 1)];
    });
  }

  // A lens held under a finger (a thumb, the tab and segment lenses), as iOS 27 draws it:
  // clear to the edge, then a dark hairline just outside it all the way round, about 0.8pt and
  // a quarter darker than what's behind; a bright line about 1pt deep just inside it along the
  // top and bottom, lit from straight above and below as glass at rest is; and a faint shade
  // inside the ends. No sheen, no glow and no colour of its own: what colour shows at its rim
  // is what's behind, bent. Measured in the simulator over a colourful grid and plain white.
  function lensRim(width: number, height: number, radius: number, shine: number, density: number): Paint {
    const strength = clamp(shine / 0.6, 0.4, 1.6);
    return drawRim(width, height, radius, density, 2, (distance, nx, ny) => {
      let light = 0;
      let shade = 0;
      if (distance < 0) {
        shade = clamp(1 + distance / 0.8, 0, 1) * 0.27;
      } else {
        light = ny * ny * clamp(1.1 - distance, 0, 1) * 0.34;
        shade = nx * nx * clamp(1 - distance / 1.6, 0, 1) * 0.1;
      }
      return [clamp(light * strength, 0, 1), clamp(shade * strength, 0, 1)];
    });
  }

  /** A tab lens's maps for a capsule: how far each point reaches in, across and down, and where it bends at all. */
  function bend(width: number, height: number, density: number): Paint {
    const columns = Math.max(1, Math.ceil(width * density));
    const rows = Math.max(1, Math.ceil(height * density));
    const across = image(columns, rows);
    const down = image(columns, rows);
    const band = image(columns, rows);
    const radius = Math.min(width, height) / 2;
    // Within the band nothing bends: no pull either way, and no rim.
    flat(across, 128, 128, 128, 255);
    flat(down, 128, 128, 128, 255);

    rimPixels(columns, rows, density, BEND_BAND, radius, (x, y) => {
      const px = ((x + 0.5) * width) / columns - width / 2;
      const py = ((y + 0.5) * height) / rows - height / 2;
      const qx = Math.abs(px) - (width / 2 - radius);
      const qy = Math.abs(py) - (height / 2 - radius);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const length = Math.hypot(ox, oy);
      const distance = radius - (length + Math.min(Math.max(qx, qy), 0));
      const nx = length > 0 ? (ox / length) * Math.sign(px) : qx > qy ? Math.sign(px) : 0;
      const ny = length > 0 ? (oy / length) * Math.sign(py) : qx > qy ? 0 : Math.sign(py);
      // Steepest at the rim and easing to nothing at the band's inner edge.
      const t = clamp(1 - Math.max(distance, 0) / BEND_BAND, 0, 1);
      const reach = t * t;
      const i = (y * columns + x) * 4;
      // Each point draws from further in, so the map points inward.
      const gx = Math.round(127.5 - nx * reach * 127.5);
      const gy = Math.round(127.5 - ny * reach * 127.5);
      across.data.fill(gx, i, i + 3);
      across.data[i + 3] = 255;
      down.data.fill(gy, i, i + 3);
      down.data[i + 3] = 255;
      band.data[i + 3] = Math.round(t * 255);
    });
    return { images: [across, down, band] };
  }

  return { displacement, mask, rim, bend, continuous, CORNER_REACH, CORNER_POWER, RIM_OUTSET, MASK_OUTSET };
}

export type PaintJob =
  | { kind: "displacement"; args: Parameters<Painter["displacement"]> }
  | { kind: "mask"; args: Parameters<Painter["mask"]> }
  | { kind: "rim"; args: Parameters<Painter["rim"]> }
  | { kind: "bend"; args: Parameters<Painter["bend"]> };
