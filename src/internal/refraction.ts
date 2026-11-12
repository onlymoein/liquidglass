import { useEffect, type RefObject } from "react";

import { local, painted, paintings, pool, type Pool } from "./painting";

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
// What each lens is made of, to take away once no glass is drawn with it.
const lensParts = new Map<string, { filter: SVGElement; maps: string }>();
let lensIds = 0;
let defs: SVGDefsElement | undefined;

/** The lenses in use. Glass holds the one it's drawn with, so a size it's left behind is let go of. */
const lensPool: Pool = pool(16, (key) => {
  const parts = lensParts.get(key);
  lenses.delete(key);
  lensParts.delete(key);
  if (!parts) return;
  parts.filter.remove();
  paintings.drop(parts.maps);
});

// What each piece of glass is drawn with, by what it's for: its lens, its rim and its mask.
// Each is held while the glass uses it and dropped when it changes or the glass goes.
type Slot = "lens" | "rim" | "mask";
const using = new WeakMap<HTMLElement, Partial<Record<Slot, [Pool, string]>>>();

function use(element: HTMLElement, slot: Slot, held?: [Pool, string]): void {
  const slots = using.get(element) ?? {};
  const before = slots[slot];
  if (before?.[0] === held?.[0] && before?.[1] === held?.[1]) return;
  if (held) held[0].hold(held[1]);
  if (before) before[0].drop(before[1]);
  if (held) slots[slot] = held;
  else delete slots[slot];
  using.set(element, slots);
}

const lensKey = (width: number, height: number, radius: number, selection: boolean, shape: Shape) =>
  Object.values({ width, height, radius, selection, ...shape }).join("-");

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

// The painter's own measures, shared with what it works out off the page.
const { continuous, CORNER_REACH, CORNER_POWER, RIM_OUTSET, MASK_OUTSET } = local;
// The same curve in CSS, where there's corner-shape. Safari gets a mask instead: on the Mac it
// has corner-shape, but it doesn't clip the backdrop to it, and the frost shows square corners.
const CORNER_SHAPE = `superellipse(${Math.log2(CORNER_POWER).toFixed(3)})`;
const hasCornerShape = () => /Chrom(?:e|ium)\//.test(navigator.userAgent) && typeof CSS !== "undefined" && CSS.supports?.("corner-shape", CORNER_SHAPE);

// Glass that's handed a map, rim or mask to come is fitted again when it arrives, if it's
// still glass by then.
const managed = new WeakMap<HTMLElement, number>();
const manage = (element: HTMLElement) => managed.set(element, (managed.get(element) ?? 0) + 1);
const release = (element: HTMLElement) => {
  const count = (managed.get(element) ?? 1) - 1;
  if (count > 0) managed.set(element, count);
  else managed.delete(element);
};
const still = (element: HTMLElement) => element.isConnected && managed.has(element);

// The filter only bends the rim. Blur and the rim highlight are applied in CSS,
// which Chromium positions correctly when it repaints part of the glass.
function lens(width: number, height: number, radius: number, selection: boolean, shape: Shape, ready: () => void): string | undefined {
  const key = lensKey(width, height, radius, selection, shape);
  const cached = lenses.get(key);
  if (cached !== undefined) return cached;

  // A pane's map is smooth, so one pixel to a point holds all of it. A lens bends steeply at its
  // rim and enlarges, and keeps the screen's own detail, up to three pixels a point.
  const density = selection ? Math.min(devicePixelRatio || 1, 3) : 1;
  const mapKey = `lens-${key}-${density}`;
  const maps = painted(
    mapKey,
    { kind: "displacement", args: [width, height, radius, selection, shape.bezel, shape.thickness, shape.zoom, density] },
    ready,
  );
  if (maps === undefined) return undefined;
  // Without a canvas there's nothing to bend by, and the glass stays as CSS draws it.
  if (maps === null) {
    lenses.set(key, "");
    return "";
  }
  const displacement = maps.urls[0]!;
  const zoomMap = maps.urls[1];
  const scale = maps.maximum! * 2 * shape.level;
  const zoom = zoomMap ? { map: zoomMap, scale: 2 * maps.reach! * (1 - 1 / shape.zoom) } : undefined;
  const id = `liquidglass-${lensIds++}`;
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
  lensParts.set(key, { filter, maps: mapKey });
  paintings.hold(mapKey);
  lensPool.made(key);
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

/** The rim's picture as a CSS image, with the painting it's from, or undefined while it's still being drawn. */
function rimFor(width: number, height: number, radius: number, shine: number, clear: number, ready: () => void): [string, string] | undefined {
  const density = Math.min(devicePixelRatio || 1, 3);
  const key = `rim-${width}-${height}-${radius}-${shine}-${clear}-${density}`;
  const rim = painted(key, { kind: "rim", args: [width, height, radius, shine, clear, density] }, ready);
  return rim ? [`url("${rim.urls[0]}")`, key] : rim === null ? ["none", key] : undefined;
}

// The rim only changes within this distance of the edge, as far in as it draws, so
// the corners and a sliver of each side are enough to build it at any size.
const RIM_REACH = 16;

function setRimPieces(element: HTMLElement, width: number, height: number, radius: number, shine: number, clear: number, ready: () => void): void {
  const density = Math.min(devicePixelRatio || 1, 3);
  const smooth = continuous(width, height, radius);
  const half = (side: number) => Math.min(side / 2, Math.ceil(Math.max(smooth ? radius * CORNER_REACH : radius, RIM_REACH)) + 1);
  const fits = (side: number) => (half(side) * 2 >= side ? side : half(side) * 2 + 2);
  const [w, h] = [fits(width), fits(height)];
  const [x, y] = [half(width) + RIM_OUTSET, half(height) + RIM_OUTSET];
  const drawn = rimFor(w, h, radius, shine, clear, ready);
  // Until its picture is drawn the glass keeps whatever rim it had.
  if (drawn === undefined) return;
  const [rim, rimKey] = drawn;
  // The sliver keeps its shape as long as the corner still has room in it.
  if (smooth && continuous(w, h, radius) && !hasCornerShape()) {
    const maskKey = `mask-${w}-${h}-${radius}-${density}`;
    const painting = painted(maskKey, { kind: "mask", args: [w, h, radius, density] }, ready);
    if (painting === undefined) return;
    const mask = painting ? `url("${painting.urls[0]}")` : "none";
    const [mx, my] = [x - RIM_OUTSET + MASK_OUTSET, y - RIM_OUTSET + MASK_OUTSET];
    element.style.setProperty("--lg-mask", `${mask} ${Math.round(my * density)} ${Math.round(mx * density)} fill / ${my}px ${mx}px / ${MASK_OUTSET}px stretch`);
    use(element, "mask", [paintings, maskKey]);
  } else {
    element.style.removeProperty("--lg-mask");
    use(element, "mask");
  }
  use(element, "rim", [paintings, rimKey]);
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
  setRimPieces(element, width, height, radius, shine, on ? 1 : clear, () => {
    if (still(element)) lightRim(element, element.hasAttribute("data-pressed"));
  });
}

function clearRim(element: HTMLElement): void {
  for (const name of ["--lg-rim", "--lg-rim-x", "--lg-rim-y", "--lg-rim-image", "--lg-mask"]) element.style.removeProperty(name);
  use(element, "rim");
  use(element, "mask");
}

function clearLens(element: HTMLElement): void {
  element.style.removeProperty("--lg-filter");
  element.style.removeProperty("--lg-lens-blur");
  element.style.removeProperty("--lg-size-curve");
  use(element, "lens");
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
  // What's still being drawn is taken up when it arrives, if this is still glass then.
  const again = () => requestAnimationFrame(() => {
    if (still(element)) fit(element, selection, filtered);
  });
  // The rim is all that's needed unless the lens can run, and costs far less to work out.
  const filter = filtered ? lens(width, height, radius, selection, shape, again) : "";
  // Small glass is brighter and throws less shadow than large glass.
  const size = clamp((Math.min(width, height) - 60) / 60, 0, 1);
  if (!selection && !element.hasAttribute("data-size-fixed")) element.style.setProperty("--lg-size", String(size));
  if (filtered && filter !== undefined) {
    element.style.setProperty("--lg-filter", filter);
    use(element, "lens", filter ? [lensPool, lensKey(width, height, radius, selection, shape)] : undefined);
    if (!selection) element.style.setProperty("--lg-lens-blur", "0px");
    // The curve is regular glass's. Clearer glass stays on the tone.
    if (!selection && refractsBackdrop() && (length("--lg-transparency") ?? 0.5) <= 0.5) {
      element.style.setProperty("--lg-size-curve", darkCurve(size));
    } else element.style.removeProperty("--lg-size-curve");
  }
  // A selection's lens stretches as it lifts and draws its rim as a background.
  if (selection) {
    const rim = rimFor(width, height, radius, shape.shine, clear, again);
    if (rim !== undefined) {
      element.style.setProperty("--lg-rim", rim[0]);
      use(element, "rim", [paintings, rim[1]]);
    }
  } else {
    drawn.set(element, [width, height, radius, shape.shine, clear]);
    // A rim refitted while the glass is held stays lit.
    setRimPieces(element, width, height, radius, shape.shine, element.hasAttribute("data-pressed") ? 1 : clear, again);
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

/** How long a size has to hold before glass is fitted to it again. */
const SETTLE_MS = 120;

// Refits the lens whenever the element changes size. Unfiltered, it sets only
// the rim highlight: the nearest Safari and Firefox come to refraction over
// content they have no copy of.
function refract(element: HTMLElement, selection: boolean, filtered: boolean, now = false): () => void {
  let cancel: (() => void) | undefined;
  manage(element);
  // The rim is cheap, and applied part-way through an opening it costs frames.
  if (now) fit(element, selection, filtered);
  // The first size is fitted as soon as the page is idle. Later ones wait for the size to stop
  // changing, so glass that's resized a pixel at a time, as a window is dragged wider, works
  // out its lens once rather than for every size it passes through.
  let first = true;
  const observer = new ResizeObserver(() => {
    cancel?.();
    if (first) {
      first = false;
      cancel = whenIdle(() => fit(element, selection, filtered));
      return;
    }
    let idle: (() => void) | undefined;
    const settle = setTimeout(() => {
      idle = whenIdle(() => fit(element, selection, filtered));
    }, SETTLE_MS);
    cancel = () => {
      clearTimeout(settle);
      idle?.();
    };
  });
  observer.observe(element);
  return () => {
    cancel?.();
    observer.disconnect();
    release(element);
    clearLens(element);
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
  manage(element);
  const draw = () => setRimPieces(element, width, height, radius, shine, 0, () => {
    if (still(element)) draw();
  });
  draw();
  return () => {
    release(element);
    clearRim(element);
  };
}

/** The lens for an element at its final size, where the browser can run it. Stop it before the size changes. */
export function fitLens(element: HTMLElement): () => void {
  if (!refractsBackdrop()) return () => {};
  manage(element);
  fit(element, false, true);
  return () => {
    release(element);
    clearLens(element);
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

// A copy never transitions on its own (it follows the original instead), and its root is placed
// by the layer rather than where the original sits. CSS animations below the root run in the copy
// too, kept in step with the original's, so a spinner that turns forever costs nothing a frame.
const STILL = /^(transition|view-transition)/;
const ANIMATION = /^animation/;
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
    if (STILL.test(name) || (root && (ANIMATION.test(name) || name in PLACED || name === "width" || name === "height"))) return;
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

// A deep copy that renders like the original wherever it's placed: each element carries its
// computed style inline, minus anything that would transition it or tie it to the original. The
// copy is made at once, and each element styled in `order`.
function cloneOf(source: HTMLElement): Copy & { order: [Element, HTMLElement][] } {
  const root = source.cloneNode(true) as HTMLElement;
  const originals = [source, ...source.querySelectorAll("*")];
  const copies = [root, ...root.querySelectorAll<HTMLElement>("*")];
  const pairs = new Map<Element, HTMLElement>();
  const order: [Element, HTMLElement][] = [];
  originals.forEach((original, index) => {
    const copy = copies[index];
    if (!copy) return;
    pairs.set(original, copy);
    order.push([original, copy]);
    copy.removeAttribute("id");
    // Detached, a lazy image would never load.
    if (copy instanceof HTMLImageElement) copy.loading = "eager";
    copy.style.transition = "none";
    if (original === source) copy.style.animation = "none";
    copy.style.setProperty("view-transition-name", "none");
  });
  root.removeAttribute(MARK);
  return { root, pairs, order };
}

function copyOf(source: HTMLElement): Copy {
  const copy = cloneOf(source);
  for (const [original, target] of copy.order) inline(original, target, original === source);
  return copy;
}

/**
 * The same copy, styled a slice at a time while the page is idle, so that copying a large
 * backdrop never holds the page up. Null if it's no longer wanted by the time it's done.
 */
function copyInSlices(source: HTMLElement, wanted: () => boolean): Promise<Copy | null> {
  const copy = cloneOf(source);
  let next = 0;
  return new Promise((resolve) => {
    const slice = (deadline?: IdleDeadline) => {
      if (!wanted()) return resolve(null);
      // A slice is kept short even when the page is idle for longer, so a tap is never kept waiting.
      const until = performance.now() + SLICE_MS;
      do {
        const [original, target] = copy.order[next++]!;
        inline(original, target, original === source);
      } while (next < copy.order.length && performance.now() < until && (!deadline || deadline.timeRemaining() > 1));
      if (next < copy.order.length) later(slice);
      else resolve(copy);
    };
    later(slice);
  });
}

function later(callback: (deadline?: IdleDeadline) => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(callback, { timeout: 200 });
  else setTimeout(callback, 0);
}

/** Puts each CSS animation in the copy at the same point as the original's. */
function keepInStep(copy: Copy): void {
  for (const [original, target] of copy.pairs) {
    if (typeof original.getAnimations !== "function" || typeof target.getAnimations !== "function") return;
    const theirs = original.getAnimations().filter(isCssAnimation);
    if (!theirs.length) continue;
    const ours = target.getAnimations().filter(isCssAnimation);
    for (const animation of ours) {
      const match = theirs.find((other) => other.animationName === animation.animationName);
      if (match && match.currentTime !== null) animation.currentTime = match.currentTime;
    }
  }
}

const isCssAnimation = (animation: Animation): animation is CSSAnimation => "animationName" in animation;

const TIMING = new Set(["offset", "computedOffset", "easing", "composite"]);

// The properties that each running transition or animation in the original
// is changing, by element.
function animating(source: HTMLElement): Map<Element, Set<string>> {
  const found = new Map<Element, Set<string>>();
  if (typeof source.getAnimations !== "function") return found;
  for (const animation of source.getAnimations({ subtree: true })) {
    const effect = animation.effect as KeyframeEffect | null;
    if (!effect?.target || effect.pseudoElement) continue;
    // The copy runs these itself.
    if (isCssAnimation(animation) && effect.target !== source) continue;
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
/** The most elements of a copy restyled in one go; more are restyled a slice at a time. */
const AT_ONCE = 60;
/** How long, in ms, a slice of copying runs before the page gets its thread back. */
const SLICE_MS = 5;
/** How often, in frames, a copy looks for motion started from script while nothing seems to move. */
const SWEEP_FRAMES = 20;

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
  keepInStep(copy);
  let stopped = false;

  // Restyles the copy in place, for anything that changes how the original looks without
  // changing what it holds. Every computed property of every element is read, so it's done at
  // most once a frame, and a change to one element restyles only it and what's inside it.
  let restyling: Set<Element> | "all" | null = null;
  let restyleFrame = 0;
  // Restyling everything, as after a resize or a change of theme, reads as much as copying, so
  // it's done a slice at a time while the page is idle. A copy on its way is styled already.
  let whole = 0;
  let restyleLate = false;
  const restyleAll = (pairs: [Element, HTMLElement][] = [...copy.pairs]) => {
    const id = ++whole;
    let next = 0;
    const slice = (deadline?: IdleDeadline) => {
      if (stopped || id !== whole) return;
      // A copy that's started is styled from what the original was, part of it before this.
      if (copying) return void (restyleLate = true);
      if (refresh) return;
      const until = performance.now() + SLICE_MS;
      do {
        const [original, target] = pairs[next++]!;
        inline(original, target, original === source);
      } while (next < pairs.length && performance.now() < until && (!deadline || deadline.timeRemaining() > 1));
      if (next < pairs.length) return later(slice);
      keepInStep(copy);
      placed = "";
      align();
    };
    later(slice);
  };
  const flush = () => {
    restyleFrame = 0;
    const which = restyling;
    restyling = null;
    if (which === "all") restyleAll();
    else if (which) {
      const pairs: [Element, HTMLElement][] = [];
      for (const changed of which) {
        if (!changed.isConnected) continue;
        for (const original of [changed, ...changed.querySelectorAll("*")]) {
          const target = copy.pairs.get(original);
          if (target) pairs.push([original, target]);
        }
      }
      // A few elements are restyled at once; a class on the backdrop itself restyles all of it,
      // which is done in slices like any restyle that large.
      if (pairs.length > AT_ONCE) return restyleAll(pairs);
      for (const [original, target] of pairs) inline(original, target, original === source);
    }
    keepInStep(copy);
    placed = "";
    align();
  };
  const restyleSoon = (what: Element | "all") => {
    if (what === "all" || restyling === "all") restyling = "all";
    else {
      restyling ??= new Set();
      restyling.add(what);
    }
    restyleFrame ||= requestAnimationFrame(flush);
  };
  const follow = () => restyleSoon("all");

  // Takes a new copy when the original's content changes, keeping the old one
  // up until the new one's images can paint.
  let refresh = 0;
  let version = 0;
  // Whatever changes while a copy is being made is restyled in it once it's up.
  let copying: Set<Element> | null = null;
  const recopy = () => {
    refresh = 0;
    const id = ++version;
    copying = new Set();
    void copyInSlices(source, () => !stopped && id === version)
      .then((next) => {
        if (!next) return null;
        const images = [...next.root.querySelectorAll("img")];
        if (next.root instanceof HTMLImageElement) images.push(next.root);
        return Promise.all(images.map((image) => (typeof image.decode === "function" ? image.decode().catch(() => undefined) : undefined))).then(() => next);
      })
      .then((next) => {
        if (!next || stopped || id !== version) return;
        frame.replaceChildren(next.root);
        copy = next;
        const late = copying;
        copying = null;
        for (const element of late ?? []) restyleSoon(element);
        if (restyleLate) {
          restyleLate = false;
          restyleAll();
        }
        keepInStep(copy);
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
      if (!target) continue;
      // Whatever changed, the element and what's in it may look different now.
      restyleSoon(record.target as Element);
      copying?.add(record.target as Element);
      if (name === "id" || name === "style" || name === MARK) continue;
      const value = (record.target as Element).getAttribute(name!);
      if (value === null) target.removeAttribute(name!);
      else target.setAttribute(name!, value);
    }
    if (content) schedule();
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

  // Each frame the copy follows the glass and what's moving in the original, but only while the
  // glass can be seen. Finding what's moving means asking every element in the original, so
  // it's asked each frame only once something has started moving, until it stops, and now and
  // then otherwise, for motion started from script, which announces nothing.
  let tick = 0;
  let seen = true;
  let started = false;
  let frames = 0;
  const loop = () => {
    tick = 0;
    if (!seen || stopped) return;
    restyle();
    if (started || moving.size || ++frames % SWEEP_FRAMES === 0) {
      animate();
      started = moving.size > 0;
    }
    align();
    tick = requestAnimationFrame(loop);
  };
  const run = () => {
    tick ||= requestAnimationFrame(loop);
  };
  const begin = () => {
    started = true;
    run();
  };
  source.addEventListener("transitionrun", begin);
  source.addEventListener("animationstart", begin);
  const shown = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
        seen = entries[entries.length - 1]!.isIntersecting;
        if (seen) {
          placed = "";
          restyle();
          align();
          run();
        }
      })
    : undefined;
  shown?.observe(element);
  run();

  return () => {
    stopped = true;
    cancelAnimationFrame(tick);
    cancelAnimationFrame(refresh);
    cancelAnimationFrame(restyleFrame);
    shown?.disconnect();
    source.removeEventListener("transitionrun", begin);
    source.removeEventListener("animationstart", begin);
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
 * Refracts what's behind the element. Chromium filters the live backdrop. Firefox filters a
 * copy of content marked `data-liquidglass-backdrop` nearby. Safari, and Firefox with nothing
 * marked, keep the live backdrop's blur with the rim highlight.
 */
export function useRefraction(ref: RefObject<HTMLElement | null>, selection = false): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (refractsBackdrop()) return refract(element, selection, true);
    // A copy is only worth its cost where it can be bent. WebKit draws nothing for the lens on
    // it, so there the glass keeps the live backdrop, which it blurs and tones as well as a copy
    // could, and over everything rather than only what's marked.
    const source = selection || !filtersCopy() ? null : findBackdrop(element);
    if (!source) return refract(element, selection, false);
    const stop = copyBackdrop(element, source);
    const unfit = refract(element, selection, true);
    return () => {
      unfit();
      stop();
    };
  }, [ref, selection]);
}
