import { useEffect, type RefObject } from "react";

// Refraction model: https://kube.io/blog/liquid-glass-css-svg/

const SVG = "http://www.w3.org/2000/svg";

interface Shape {
  bezel: number | undefined;
  thickness: number | undefined;
  blur: number;
  level: number;
  zoom: number;
  shine: number;
}

const lenses = new Map<string, string>();
let defs: SVGDefsElement | undefined;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function svg(name: string, attributes: Record<string, string | number>): SVGElement {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function container(): SVGDefsElement {
  if (defs?.isConnected) return defs;
  const root = svg("svg", { width: 0, height: 0, "aria-hidden": "true" });
  root.style.cssText = "position:absolute;pointer-events:none";
  defs = svg("defs", {}) as SVGDefsElement;
  root.append(defs);
  document.body.append(root);
  return defs;
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

// How far past the shape the rim's image reaches, for the hairline iOS draws just outside it.
const RIM_OUTSET = 1;

// iOS's corners are continuous: the curve starts further along the edge than a circle's
// would and passes through the same point at 45 degrees. This superellipse follows
// alerts, sheets, menus and panels to about a quarter of a point. A corner this long
// needs room, so anything nearly a capsule stays circular, as it does on iOS.
const CORNER_REACH = 1.2;
const CORNER_POWER = 2.5;
const continuous = (width: number, height: number, radius: number) => radius > 0 && radius * CORNER_REACH <= Math.min(width, height) / 2;
// The same curve in CSS, where there's corner-shape. Safari gets a mask instead: on the Mac it
// has corner-shape, but it doesn't clip the backdrop to it, and the frost shows square corners.
const CORNER_SHAPE = `superellipse(${Math.log2(CORNER_POWER).toFixed(3)})`;
const hasCornerShape = () => /Chrom(?:e|ium)\//.test(navigator.userAgent) && typeof CSS !== "undefined" && CSS.supports?.("corner-shape", CORNER_SHAPE);

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

// How far outside the box the shape's mask reaches, to leave its shadow alone.
const MASK_OUTSET = 44;

// CSS only draws circular corners, and Safari has no corner-shape, but a mask keeps the
// backdrop where a clip doesn't. It trims the circle down to the continuous curve, and
// leaves everything outside the circle as it was: only the shadow is out there.
function cornerMask(width: number, height: number, radius: number): string {
  const density = Math.min(devicePixelRatio || 1, 3);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((width + MASK_OUTSET * 2) * density);
  canvas.height = Math.ceil((height + MASK_OUTSET * 2) * density);
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const px = (x + 0.5) / density - MASK_OUTSET - width / 2;
      const py = (y + 0.5) / density - MASK_OUTSET - height / 2;
      const qx = Math.abs(px) - (width / 2 - radius);
      const qy = Math.abs(py) - (height / 2 - radius);
      const outsideCircle = qx > 0 && qy > 0 ? Math.hypot(qx, qy) > radius : qx > radius || qy > radius;
      // A point past the rim's hairline is cut; the hairline itself has to stay.
      const alpha = outsideCircle ? 1 : clamp(toEdge(px, py, width, height, radius).distance + RIM_OUTSET + 0.5, 0, 1);
      image.data[(y * canvas.width + x) * 4 + 3] = Math.round(alpha * 255);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

// iOS 27 lights glass from straight above and below: a bright line along the top
// and bottom, a dark hairline just outside the sides and more faintly round the
// rest, and a faint shade inside everywhere but the bottom. Measured in parity/.
function rimImage(width: number, height: number, radius: number, shine: number, clear: number): string {
  const density = Math.min(devicePixelRatio || 1, 3);
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil((width + RIM_OUTSET * 2) * density);
  canvas.height = Math.ceil((height + RIM_OUTSET * 2) * density);
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const px = (x + 0.5) / density - RIM_OUTSET - width / 2;
      const py = (y + 0.5) / density - RIM_OUTSET - height / 2;
      const { distance, nx, ny } = toEdge(px, py, width, height, radius);
      if (distance > 15) continue;
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
      light = clamp(light * shine * (1 + clear * 1.1), 0, 1);
      shade = clamp(shade * shine, 0, 1);
      const alpha = light + shade - light * shade;
      if (alpha <= 0) continue;
      const i = (y * canvas.width + x) * 4;
      const white = Math.round((255 * light) / (light + shade));
      image.data[i] = image.data[i + 1] = image.data[i + 2] = white;
      image.data[i + 3] = Math.round(alpha * 255);
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

function maps(width: number, height: number, radius: number, selection: boolean, shape: Shape) {
  const density = Math.min(devicePixelRatio || 1, selection ? 3 : 2);
  const short = Math.min(width, height);
  const bezel = shape.bezel ?? (selection ? clamp(short * 0.12, 4, 10) : clamp(2.4 + short * 0.059, 3, 12));
  const { samples, maximum } = selection
    ? profile(bezel, shape.thickness ?? clamp(short * 0.2, 8, 24))
    : rimProfile(shape.thickness ?? Math.min(short * 0.33, 48));

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * density);
  canvas.height = Math.ceil(height * density);
  const context = canvas.getContext("2d")!;
  const field = context.createImageData(canvas.width, canvas.height);
  const magnify = shape.zoom > 1 ? context.createImageData(canvas.width, canvas.height) : undefined;
  const reach = Math.max(width, height) / 2;
  const direction = selection ? 1 : -1;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const px = ((x + 0.5) * width) / canvas.width - width / 2;
      const py = ((y + 0.5) * height) / canvas.height - height / 2;
      const qx = Math.abs(px) - (width / 2 - radius);
      const qy = Math.abs(py) - (height / 2 - radius);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const length = Math.hypot(ox, oy);
      const distance = radius - (length + Math.min(Math.max(qx, qy), 0));
      const nx = length > 0 ? (ox / length) * Math.sign(px) : qx > qy ? Math.sign(px) : 0;
      const ny = length > 0 ? (oy / length) * Math.sign(py) : qx > qy ? 0 : Math.sign(py);

      let shift = 0;
      if (distance >= 0 && distance < bezel) {
        const sample = (distance / bezel) * (samples.length - 1);
        const lower = Math.floor(sample);
        const a = samples[lower]!;
        const b = samples[Math.min(lower + 1, samples.length - 1)]!;
        shift = a + (b - a) * (sample - lower);
      }

      const i = (y * canvas.width + x) * 4;
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
    }
  }

  context.putImageData(field, 0, 0);
  const displacement = canvas.toDataURL();
  let zoom: { map: string; scale: number } | undefined;
  if (magnify) {
    context.putImageData(magnify, 0, 0);
    zoom = { map: canvas.toDataURL(), scale: 2 * reach * (1 - 1 / shape.zoom) };
  }
  return { displacement, zoom, scale: maximum * 2 * shape.level };
}

// The filter only bends the rim. Blur and the rim highlight are applied in CSS,
// which Chromium positions correctly when it repaints part of the glass.
function lens(width: number, height: number, radius: number, selection: boolean, shape: Shape): string {
  const key = Object.values({ width, height, radius, selection, ...shape }).join("-");
  const cached = lenses.get(key);
  if (cached) return cached;

  const { displacement, zoom, scale } = maps(width, height, radius, selection, shape);
  const id = `liquidglass-${lenses.size}`;
  const box = { x: 0, y: 0, width, height };
  const filter = svg("filter", {
    id,
    ...box,
    filterUnits: "userSpaceOnUse",
    primitiveUnits: "userSpaceOnUse",
    "color-interpolation-filters": "sRGB",
  });

  filter.append(svg("feImage", { href: displacement, ...box, preserveAspectRatio: "none", result: "field" }));

  if (selection) {
    const channels = [
      ["r", 1.035, "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"],
      ["g", 1, "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"],
      ["b", 0.965, "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"],
    ] as const;
    for (const [name, factor, values] of channels) {
      filter.append(
        svg("feDisplacementMap", {
          in: "SourceGraphic",
          in2: "field",
          scale: scale * factor,
          xChannelSelector: "R",
          yChannelSelector: "G",
          result: `${name}-ray`,
        }),
        svg("feColorMatrix", { in: `${name}-ray`, type: "matrix", values, result: name }),
      );
    }
    filter.append(
      svg("feComposite", { in: "r", in2: "g", operator: "arithmetic", k2: 1, k3: 1, result: "rg" }),
      svg("feComposite", { in: "rg", in2: "b", operator: "arithmetic", k2: 1, k3: 1 }),
    );
  } else {
    // Blurring here rather than in CSS keeps the lens lined up: Chromium offsets
    // a filter that follows a CSS blur by the blur's padding. The blur fades out
    // at the box's edge, so the plain backdrop sits under it, and the rim shows
    // a little of the sharp image, as it does on iOS.
    filter.append(
      svg("feGaussianBlur", { in: "SourceGraphic", stdDeviation: shape.blur, result: "wide" }),
      merged("wide"),
    );
    if (zoom) {
      filter.append(
        svg("feImage", { href: zoom.map, ...box, preserveAspectRatio: "none", result: "zoom" }),
        svg("feDisplacementMap", {
          in: "base",
          in2: "zoom",
          scale: zoom.scale,
          xChannelSelector: "R",
          yChannelSelector: "G",
          result: "magnified",
        }),
      );
    }
    filter.append(
      svg("feDisplacementMap", {
        in: zoom ? "magnified" : "base",
        in2: "field",
        scale,
        xChannelSelector: "R",
        yChannelSelector: "G",
        result: "bent",
      }),
      // The displacement samples the nearest pixel, which leaves stair-steps
      // where the rim bends hardest; a sub-pixel blur smooths them. A sharp lens
      // keeps it slight, or the labels under it go soft and dim.
      svg("feGaussianBlur", { in: "bent", stdDeviation: shape.blur === 0 ? 0.12 : 0.4, result: "face" }),
    );
  }
  container().append(filter);

  const result = `url("#${id}")`;
  lenses.set(key, result);
  return result;
}

function merged(top: string): SVGElement {
  const merge = svg("feMerge", { result: "base" });
  merge.append(svg("feMergeNode", { in: "SourceGraphic" }), svg("feMergeNode", { in: top }));
  return merge;
}

// In dark mode iOS glass isn't linear: brightness peaks over light greys and falls
// again over white, and colour fades as the backdrop gets brighter. Glass 60 points
// tall or less keeps more of it than glass 120 or more, and sizes between go between.
// CSS filters can't follow that, but an SVG filter can, where it's allowed on the
// backdrop. Measured values, by the backdrop's luminance from black to white.
const DARK = {
  small: {
    brightness: [32, 62, 89, 113, 134, 151, 166, 177, 185],
    colour: [1.27, 1.22, 1.18, 1.13, 1.08, 1.03, 0.98, 0.94, 0.89],
  },
  large: {
    brightness: [32, 59, 83, 102, 117, 126, 129, 128, 121],
    colour: [1.27, 1.19, 1.11, 1.03, 0.95, 0.87, 0.79, 0.71, 0.63],
  },
};
const COLOUR_RANGE = 1.3;
const darkCurves = new Set<number>();

function darkCurve(size: number): string {
  const step = Math.round(size * 4);
  const id = `liquidglass-dark-${step}`;
  if (darkCurves.has(step)) return `url("#${id}")`;
  darkCurves.add(step);
  const mix = (from: number[], to: number[]) => from.map((value, i) => value + (to[i]! - value) * (step / 4));
  const brightness = mix(DARK.small.brightness, DARK.large.brightness).map((level) => level / 255);
  const gain = mix(DARK.small.colour, DARK.large.colour).map((value) => value / COLOUR_RANGE);
  const table = (values: number[], result: string) => {
    const transfer = svg("feComponentTransfer", { in: "luminance", result });
    for (const channel of ["feFuncR", "feFuncG", "feFuncB"]) {
      transfer.append(svg(channel, { type: "table", tableValues: values.join(" ") }));
    }
    return transfer;
  };
  const [r, g, b] = [0.2126, 0.7152, 0.0722];
  const k = COLOUR_RANGE / 2;
  const row = (own: number) => [r, g, b].map((weight, i) => k * ((i === own ? 1 : 0) - weight)).join(" ");
  const filter = svg("filter", { id, "color-interpolation-filters": "sRGB" });
  filter.append(
    svg("feColorMatrix", { in: "SourceGraphic", values: `${r} ${g} ${b} 0 0 ${r} ${g} ${b} 0 0 ${r} ${g} ${b} 0 0 0 0 0 1 0`, result: "luminance" }),
    table(brightness, "brightness"),
    table(gain, "gain"),
    table(gain.map((value) => 0.5 * (1 - value)), "offset"),
    // Colour as a difference from grey, held around 0.5 because filters can't go below zero.
    svg("feColorMatrix", { in: "SourceGraphic", values: `${row(0)} 0 0.5 ${row(1)} 0 0.5 ${row(2)} 0 0.5 0 0 0 1 0`, result: "colour" }),
    svg("feComposite", { in: "colour", in2: "gain", operator: "arithmetic", k1: 1, result: "scaled" }),
    svg("feComposite", { in: "scaled", in2: "offset", operator: "arithmetic", k2: 1, k3: 1, result: "centred" }),
    svg("feComposite", { in: "centred", in2: "brightness", operator: "arithmetic", k2: 2, k3: 1, k4: -1 }),
  );
  container().append(filter);
  return `url("#${id}")`;
}

const rims = new Map<string, string>();

function rimFor(width: number, height: number, radius: number, shine: number, clear = 0): string {
  const key = `${width}-${height}-${radius}-${shine}-${clear}-${devicePixelRatio}`;
  let rim = rims.get(key);
  if (!rim) {
    rim = `url("${rimImage(width, height, radius, shine, clear)}")`;
    rims.set(key, rim);
  }
  return rim;
}

// The rim only changes within this distance of the edge, as far in as it draws, so
// the corners and a sliver of each side are enough to build it at any size.
const RIM_REACH = 16;

function setRimPieces(element: HTMLElement, width: number, height: number, radius: number, shine: number, clear = 0): void {
  const density = Math.min(devicePixelRatio || 1, 3);
  const smooth = continuous(width, height, radius);
  const half = (side: number) => Math.min(side / 2, Math.ceil(Math.max(smooth ? radius * CORNER_REACH : radius, RIM_REACH)) + 1);
  const fits = (side: number) => (half(side) * 2 >= side ? side : half(side) * 2 + 2);
  const [w, h] = [fits(width), fits(height)];
  const [x, y] = [half(width) + RIM_OUTSET, half(height) + RIM_OUTSET];
  const rim = rimFor(w, h, radius, shine, clear);
  // The sliver keeps its shape as long as the corner still has room in it.
  if (smooth && continuous(w, h, radius) && !hasCornerShape()) {
    const key = `mask-${w}-${h}-${radius}-${devicePixelRatio}`;
    let mask = rims.get(key);
    if (!mask) {
      mask = `url("${cornerMask(w, h, radius)}")`;
      rims.set(key, mask);
    }
    const [mx, my] = [x - RIM_OUTSET + MASK_OUTSET, y - RIM_OUTSET + MASK_OUTSET];
    element.style.setProperty("--lg-mask", `${mask} ${Math.round(my * density)} ${Math.round(mx * density)} fill / ${my}px ${mx}px / ${MASK_OUTSET}px stretch`);
  } else element.style.removeProperty("--lg-mask");
  element.style.setProperty("--lg-rim-x", `${x}px`);
  element.style.setProperty("--lg-rim-y", `${y}px`);
  element.style.setProperty("--lg-rim-image", `${rim} ${Math.round(y * density)} ${Math.round(x * density)} fill / ${y}px ${x}px / 0 stretch`);
}

// What each piece of glass last drew its rim from, so it can be drawn again lit.
const drawn = new WeakMap<HTMLElement, [number, number, number, number, number]>();

/**
 * Lights the edge of glass that's being held, as clear glass's is: iOS shows its rim
 * brightest when a finger is on it. `on` false puts back the rim it was drawn with.
 */
export function lightRim(element: HTMLElement, on: boolean): void {
  const rim = drawn.get(element);
  if (!rim) return;
  const [width, height, radius, shine, clear] = rim;
  setRimPieces(element, width, height, radius, shine, on ? 1 : clear);
}

function clearRim(element: HTMLElement): void {
  for (const name of ["--lg-rim", "--lg-rim-x", "--lg-rim-y", "--lg-rim-image", "--lg-mask"]) element.style.removeProperty(name);
}

function fit(element: HTMLElement, selection: boolean, filtered: boolean): void {
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  if (!width || !height) return;
  const style = getComputedStyle(element);
  const corner = style.borderTopLeftRadius;
  // What was asked for, if the radius is still the one this set for a continuous corner.
  const asked = element.dataset.lgCornerSet === corner ? parseFloat(element.dataset.lgCorner!) : NaN;
  const radius = Number.isNaN(asked)
    ? Math.min(width / 2, height / 2, corner.endsWith("%") ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner))
    : asked;
  // Corners that differ, as on a sheet at full height, stay as CSS draws them.
  const even = style.borderBottomLeftRadius === corner;
  if (!selection && even && continuous(width, height, radius) && hasCornerShape()) {
    const reach = `${radius * CORNER_REACH}px`;
    element.style.borderRadius = reach;
    element.style.setProperty("corner-shape", CORNER_SHAPE);
    element.dataset.lgCorner = String(radius);
    element.dataset.lgCornerSet = reach;
  } else if (element.dataset.lgCornerSet) {
    element.style.removeProperty("corner-shape");
    delete element.dataset.lgCorner;
    delete element.dataset.lgCornerSet;
  }
  const length = (name: string) => {
    const value = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : undefined;
  };
  const clear = clamp(((length("--lg-transparency") ?? 0.5) - 0.5) * 2, 0, 1);
  const shape = {
    bezel: length("--lg-bezel"),
    thickness: length("--lg-thickness"),
    // A blur the glass sets for itself, as a thumb's lens does, wins.
    blur: parseFloat(style.getPropertyValue("--lg-blur").trim()) === 0 ? 0 : 15.3 - 14 * clear,
    level: length("--lg-refraction") ?? 1,
    zoom: Math.max(1, length("--lg-zoom") ?? 1),
    shine: Math.max(0, length("--lg-shine") ?? 1),
  };
  // The rim is all that's needed unless the lens can run, and costs far less to work out.
  const filter = filtered ? lens(width, height, radius, selection, shape) : "";
  // Small glass is brighter and throws less shadow than large glass.
  const size = clamp((Math.min(width, height) - 60) / 60, 0, 1);
  if (!selection && !element.hasAttribute("data-size-fixed")) element.style.setProperty("--lg-size", String(size));
  if (filtered) {
    element.style.setProperty("--lg-filter", filter);
    if (!selection) element.style.setProperty("--lg-lens-blur", "0px");
    // The curve is regular glass's. Clearer glass stays on the tone.
    if (!selection && refractsBackdrop() && (length("--lg-transparency") ?? 0.5) <= 0.5) {
      element.style.setProperty("--lg-size-curve", darkCurve(size));
    } else element.style.removeProperty("--lg-size-curve");
  }
  // A selection's lens stretches as it lifts and draws its rim as a background.
  if (selection) element.style.setProperty("--lg-rim", rimFor(width, height, radius, shape.shine, clear));
  else {
    drawn.set(element, [width, height, radius, shape.shine, clear]);
    // A rim refitted while the glass is held stays lit.
    setRimPieces(element, width, height, radius, shape.shine, element.hasAttribute("data-pressed") ? 1 : clear);
    if (!even) element.style.removeProperty("--lg-mask");
  }
}

function whenIdle(callback: () => void): () => void {
  if ("requestIdleCallback" in window) {
    const handle = requestIdleCallback(callback, { timeout: 500 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(callback, 50);
  return () => clearTimeout(handle);
}

/** Only Chromium applies SVG filters to the live backdrop. */
export const refractsBackdrop = (): boolean => /Chrom(?:e|ium)\//.test(navigator.userAgent);

/** WebKit draws nothing for an SVG filter with an image in it, so its copy gets CSS filters alone. */
const filtersCopy = (): boolean => !/AppleWebKit\//.test(navigator.userAgent);

// Refits the lens whenever the element changes size. Unfiltered, it sets only
// the rim highlight: the nearest Safari and Firefox come to refraction over
// content they have no copy of.
function refract(element: HTMLElement, selection: boolean, filtered: boolean, now = false): () => void {
  let cancel: (() => void) | undefined;
  // The rim is cheap, and applied part-way through an opening it costs frames.
  if (now) fit(element, selection, filtered);
  const observer = new ResizeObserver(() => {
    cancel?.();
    cancel = whenIdle(() => fit(element, selection, filtered));
  });
  observer.observe(element);
  return () => {
    cancel?.();
    observer.disconnect();
    element.style.removeProperty("--lg-filter");
    element.style.removeProperty("--lg-lens-blur");
    element.style.removeProperty("--lg-size-curve");
    element.style.removeProperty("--lg-size");
    clearRim(element);
  };
}

/** The rim alone, kept fitted as the element changes size. */
export const fitRim = (element: HTMLElement): (() => void) => refract(element, false, false, true);

/** The rim for a size the element is about to reach, so it needn't be worked out on the way there. */
export function rimAt(element: HTMLElement, width: number, height: number, radius: number): () => void {
  if (!width || !height) return () => {};
  const shine = parseFloat(getComputedStyle(element).getPropertyValue("--lg-shine")) || 1;
  setRimPieces(element, width, height, radius, shine);
  return () => clearRim(element);
}

/** The lens for an element at its final size, where the browser can run it. Stop it before the size changes. */
export function fitLens(element: HTMLElement): () => void {
  if (!refractsBackdrop()) return () => {};
  fit(element, false, true);
  return () => {
    element.style.removeProperty("--lg-filter");
    element.style.removeProperty("--lg-lens-blur");
    element.style.removeProperty("--lg-size-curve");
  };
}

const MARK = "data-liquidglass-backdrop";

// The part of an element that can be seen, cut down by every ancestor that
// clips its overflow (a large image inside a small scroller shows only the scroller).
function visibleBox(element: HTMLElement): DOMRect {
  let { left, top, right, bottom } = element.getBoundingClientRect();
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (!/hidden|clip|auto|scroll/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) continue;
    const clip = node.getBoundingClientRect();
    left = Math.max(left, clip.left);
    top = Math.max(top, clip.top);
    right = Math.min(right, clip.right);
    bottom = Math.min(bottom, clip.bottom);
  }
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}

/** The marked content behind the glass: the closest one whose visible part it overlaps. */
function findBackdrop(element: HTMLElement): HTMLElement | null {
  const box = element.getBoundingClientRect();
  const behind = (candidate: HTMLElement) => {
    if (candidate.contains(element) || element.contains(candidate)) return false;
    const other = visibleBox(candidate);
    return other.left < box.right && other.right > box.left && other.top < box.bottom && other.bottom > box.top;
  };
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const found = [...node.querySelectorAll<HTMLElement>(`[${MARK}]`)].find(behind);
    if (found) return found;
  }
  return null;
}

// A copy never animates on its own (it follows the original instead), and its
// root is placed by the layer rather than where the original sits.
const STILL = /^(transition|animation|view-transition)/;
const PLACED: Record<string, string> = {
  position: "absolute",
  top: "0px",
  left: "0px",
  right: "auto",
  bottom: "auto",
  "margin-top": "0px",
  "margin-right": "0px",
  "margin-bottom": "0px",
  "margin-left": "0px",
  transform: "none",
  translate: "none",
  scale: "none",
  rotate: "none",
};

const kebab = (name: string) => (name.startsWith("--") ? name : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

interface Copy {
  root: HTMLElement;
  /** Each element of the original, with its copy. */
  pairs: Map<Element, HTMLElement>;
}

// Writes an element's computed style onto its copy: every property, or only
// the named ones.
function inline(original: Element, copy: HTMLElement, root: boolean, names?: Iterable<string>): void {
  const computed = getComputedStyle(original);
  const write = (name: string) => {
    if (STILL.test(name) || (root && (name in PLACED || name === "width" || name === "height"))) return;
    const value = computed.getPropertyValue(name);
    if (copy.style.getPropertyValue(name) !== value) copy.style.setProperty(name, value);
  };
  if (names) for (const name of names) write(name);
  else for (let i = 0; i < computed.length; i++) write(computed[i]!);
  if (!root) return;
  for (const [name, value] of Object.entries(PLACED)) copy.style.setProperty(name, value);
  copy.style.width = `${(original as HTMLElement).offsetWidth}px`;
  copy.style.height = `${(original as HTMLElement).offsetHeight}px`;
}

// A deep copy that renders like the original wherever it's placed: each
// element carries its computed style inline, minus anything that would animate
// it or tie it to the original.
function copyOf(source: HTMLElement): Copy {
  const root = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll("*")];
  const copies = [root, ...root.querySelectorAll<HTMLElement>("*")];
  const pairs = new Map<Element, HTMLElement>();
  originals.forEach((original, index) => {
    const copy = copies[index];
    if (!copy) return;
    pairs.set(original, copy);
    copy.removeAttribute("id");
    // Detached, a lazy image would never load.
    if (copy instanceof HTMLImageElement) copy.loading = "eager";
    copy.style.transition = copy.style.animation = "none";
    copy.style.setProperty("view-transition-name", "none");
    inline(original, copy, original === source);
  });
  root.removeAttribute(MARK);
  return { root, pairs };
}

const TIMING = new Set(["offset", "computedOffset", "easing", "composite"]);

// The properties that each running transition or animation in the original
// is changing, by element.
function animating(source: HTMLElement): Map<Element, Set<string>> {
  const found = new Map<Element, Set<string>>();
  if (typeof source.getAnimations !== "function") return found;
  for (const animation of source.getAnimations({ subtree: true })) {
    const effect = animation.effect as KeyframeEffect | null;
    if (!effect?.target || effect.pseudoElement) continue;
    const names = found.get(effect.target) ?? new Set<string>();
    if ("transitionProperty" in animation) names.add(String(animation.transitionProperty));
    else
      for (const keyframe of effect.getKeyframes())
        for (const key of Object.keys(keyframe)) if (!TIMING.has(key)) names.add(kebab(key));
    found.set(effect.target, names);
  }
  return found;
}

const SOURCE = new Set(["src", "srcset", "sizes"]);

// Where the live backdrop can't be filtered, a copy of the marked content is
// filtered instead, in a layer laid just behind the glass and matched to its
// box. The glass then paints its tint, rim and shadows over it, as it would
// over the live backdrop.
function copyBackdrop(element: HTMLElement, source: HTMLElement): () => void {
  const layer = document.createElement("div");
  const frame = document.createElement("div");
  layer.className = "lg-glass-copy";
  layer.setAttribute("aria-hidden", "true");
  layer.setAttribute("inert", "");
  layer.append(frame);
  element.before(layer);
  element.setAttribute("data-copy", "");

  // The layer is a sibling, so it copies the glass's filter, shape and
  // opacity rather than inheriting them. Checked every frame so transitions
  // on the glass carry over.
  const style = getComputedStyle(element);
  let styled = "";
  const restyle = () => {
    const read = (name: string) => style.getPropertyValue(name).trim();
    const next = [`blur(${read("--lg-lens-blur") || read("--lg-blur") || "15.3px"}) ${read("--lg-filter")} ${read("--lg-tone")}`, style.borderRadius, style.opacity, style.visibility];
    if (next.join("|") === styled) return;
    styled = next.join("|");
    layer.style.filter = next[0]!;
    layer.style.borderRadius = next[1]!;
    layer.style.clipPath = `inset(0 round ${next[1]})`;
    layer.style.opacity = next[2]!;
    layer.style.visibility = next[3]!;
  };

  let placed = "";
  let shift = { x: 0, y: 0 };
  const align = () => {
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (!width || !height || !source.offsetWidth || !source.offsetHeight) {
      layer.style.display = "none";
      return;
    }
    layer.style.display = "";
    const box = element.getBoundingClientRect();
    const from = source.getBoundingClientRect();
    const at = layer.getBoundingClientRect();
    const sx = box.width / width;
    const sy = box.height / height;
    // The layer's untransformed origin, recovered from where it sits now.
    const x = box.left - (at.left - shift.x);
    const y = box.top - (at.top - shift.y);
    const next = [
      width,
      height,
      `translate(${x}px, ${y}px) scale(${sx}, ${sy})`,
      `translate(${(from.left - box.left) / sx}px, ${(from.top - box.top) / sy}px) scale(${
        from.width / source.offsetWidth / sx
      }, ${from.height / source.offsetHeight / sy})`,
    ].join("|");
    if (next === placed) return;
    placed = next;
    shift = { x, y };
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
    layer.style.transform = `translate(${x}px, ${y}px) scale(${sx}, ${sy})`;
    frame.style.transform = next.split("|")[3]!;
  };

  let copy = copyOf(source);
  frame.append(copy.root);
  let stopped = false;

  // Restyles the copy in place, for anything that changes how the original
  // looks without changing what it holds.
  const follow = () => {
    for (const [original, target] of copy.pairs) inline(original, target, original === source);
    placed = "";
    align();
  };

  // Takes a new copy when the original's content changes, keeping the old one
  // up until the new one's images can paint.
  let refresh = 0;
  let version = 0;
  const recopy = () => {
    refresh = 0;
    const next = copyOf(source);
    const id = ++version;
    const images = [...next.root.querySelectorAll("img")];
    if (next.root instanceof HTMLImageElement) images.push(next.root);
    void Promise.all(
      images.map((image) => (typeof image.decode === "function" ? image.decode().catch(() => undefined) : undefined)),
    ).then(() => {
      if (stopped || id !== version) return;
      frame.replaceChildren(next.root);
      copy = next;
      placed = "";
      align();
    });
  };
  const schedule = () => {
    refresh ||= requestAnimationFrame(recopy);
  };

  // Transitions and animations in the original play in the copy too: each
  // frame, whatever they're changing is copied across, and once more after
  // they finish so the copy settles where the original does.
  let moving = new Map<Element, Set<string>>();
  const animate = () => {
    const now = animating(source);
    for (const [original, names] of new Map([...moving, ...now])) {
      const target = copy.pairs.get(original);
      if (target) inline(original, target, original === source, names);
    }
    moving = now;
  };

  // Moving or restyling the glass realigns before the frame is drawn, so the
  // copy never trails it. Scrolls and resizes realign as they happen, and a
  // per-frame check catches anything else that moves either one.
  const moved = new MutationObserver(() => {
    restyle();
    align();
  });
  moved.observe(element, { attributes: true, attributeFilter: ["style", "class", "disabled"] });
  const changed = new MutationObserver((records) => {
    let content = false;
    for (const record of records) {
      const name = record.attributeName;
      if (record.type !== "attributes" || SOURCE.has(name!)) {
        content = true;
        continue;
      }
      const target = copy.pairs.get(record.target as Element);
      if (!target || name === "id" || name === "style" || name === MARK) continue;
      const value = (record.target as Element).getAttribute(name!);
      if (value === null) target.removeAttribute(name!);
      else target.setAttribute(name!, value);
    }
    if (content) schedule();
    follow();
  });
  changed.observe(source, { attributes: true, childList: true, characterData: true, subtree: true });
  // A theme or state set further up, such as data-theme on the page, restyles
  // the original without touching it.
  const context = new MutationObserver(follow);
  for (let node = source.parentElement; node; node = node.parentElement) context.observe(node, { attributes: true });
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", follow);
  const resized = new ResizeObserver(follow);
  resized.observe(source);
  source.addEventListener("load", follow, true);
  source.addEventListener("transitionend", follow);
  document.addEventListener("scroll", align, { capture: true, passive: true });
  window.addEventListener("resize", align);
  restyle();
  align();
  let tick = 0;
  const loop = () => {
    restyle();
    animate();
    align();
    tick = requestAnimationFrame(loop);
  };
  tick = requestAnimationFrame(loop);

  return () => {
    stopped = true;
    cancelAnimationFrame(tick);
    cancelAnimationFrame(refresh);
    moved.disconnect();
    changed.disconnect();
    context.disconnect();
    resized.disconnect();
    scheme.removeEventListener("change", follow);
    source.removeEventListener("load", follow, true);
    source.removeEventListener("transitionend", follow);
    document.removeEventListener("scroll", align, { capture: true });
    window.removeEventListener("resize", align);
    layer.remove();
    element.removeAttribute("data-copy");
  };
}

/**
 * Refracts what's behind the element. Chromium filters the live backdrop.
 * Safari and Firefox filter a copy of content marked `data-liquidglass-backdrop`
 * nearby, and otherwise keep the blur with the rim highlight.
 */
export function useRefraction(ref: RefObject<HTMLElement | null>, selection = false): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (refractsBackdrop()) return refract(element, selection, true);
    const source = selection ? null : findBackdrop(element);
    if (!source) return refract(element, selection, false);
    const stop = copyBackdrop(element, source);
    const unfit = refract(element, selection, filtersCopy());
    return () => {
      unfit();
      stop();
    };
  }, [ref, selection]);
}
