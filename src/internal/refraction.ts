import { useEffect, type RefObject } from "react";

// Refraction model: https://kube.io/blog/liquid-glass-css-svg/

const SVG = "http://www.w3.org/2000/svg";
interface Lens {
  filter: string;
  rim: string;
}

interface Shape {
  bezel: number | undefined;
  thickness: number | undefined;
  blur: number;
  level: number;
  zoom: number;
  shine: number;
}

const lenses = new Map<string, Lens>();
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

// iOS 27 lights glass from straight above and below: a bright line along the top
// and bottom, a dark hairline just outside the sides and more faintly round the
// rest, and a faint shade inside everywhere but the bottom. Measured in parity/.
function rimImage(width: number, height: number, radius: number, shine: number): string {
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
      const qx = Math.abs(px) - (width / 2 - radius);
      const qy = Math.abs(py) - (height / 2 - radius);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      const length = Math.hypot(ox, oy);
      const distance = radius - (length + Math.min(Math.max(qx, qy), 0));
      if (distance > 15) continue;
      const nx = length > 0 ? (ox / length) * Math.sign(px) : qx > qy ? Math.sign(px) : 0;
      const ny = length > 0 ? (oy / length) * Math.sign(py) : qx > qy ? 0 : Math.sign(py);
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
      light = clamp(light * shine, 0, 1);
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
  const density = Math.min(devicePixelRatio || 1, 3);
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
  const shine = context.createImageData(canvas.width, canvas.height);
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

      const facing = -(nx + ny) * Math.SQRT1_2;
      const glint = Math.max(facing, 0) ** 3;
      const reflected = Math.max(-facing, 0) ** 3;
      shine.data[i] = shine.data[i + 1] = shine.data[i + 2] = 255;

      let alpha = 0;
      if (distance >= 0 && selection) {
        const bands = [0.18, 0.42, 0.66].map((centre) => Math.exp(-(((distance - centre) / 0.22) ** 2)));
        const peak = Math.max(...bands);
        alpha = peak * (0.06 + 0.8 * glint + 0.35 * reflected) * 0.85;
        for (let channel = 0; channel < 3; channel++) {
          shine.data[i + channel] = Math.round(255 * (0.65 + 0.35 * (peak ? bands[channel]! / peak : 0)));
        }
      }
      shine.data[i + 3] = Math.round(clamp(alpha * shape.shine, 0, 1) * 255);
    }
  }

  context.putImageData(field, 0, 0);
  const displacement = canvas.toDataURL();
  context.putImageData(shine, 0, 0);
  const highlight = selection ? canvas.toDataURL() : rimImage(width, height, radius, shape.shine);
  let zoom: { map: string; scale: number } | undefined;
  if (magnify) {
    context.putImageData(magnify, 0, 0);
    zoom = { map: canvas.toDataURL(), scale: 2 * reach * (1 - 1 / shape.zoom) };
  }
  return { displacement, highlight, zoom, scale: maximum * 2 * shape.level };
}

// The filter only bends the rim. Blur and the rim highlight are applied in CSS,
// which Chromium positions correctly when it repaints part of the glass.
function lens(width: number, height: number, radius: number, selection: boolean, shape: Shape): Lens {
  const key = Object.values({ width, height, radius, selection, ...shape }).join("-");
  const cached = lenses.get(key);
  if (cached) return cached;

  const { displacement, highlight, zoom, scale } = maps(width, height, radius, selection, shape);
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
      // where the rim bends hardest; a sub-pixel blur smooths them.
      svg("feGaussianBlur", { in: "bent", stdDeviation: 0.4, result: "face" }),
    );
  }
  container().append(filter);

  const result = { filter: `url("#${id}")`, rim: `url("${highlight}")` };
  lenses.set(key, result);
  return result;
}

function merged(top: string): SVGElement {
  const merge = svg("feMerge", { result: "base" });
  merge.append(svg("feMergeNode", { in: "SourceGraphic" }), svg("feMergeNode", { in: top }));
  return merge;
}

// In dark mode iOS glass isn't linear: brightness peaks over light greys and
// falls again over white, and colour fades as the backdrop gets brighter. CSS
// filters can't follow that, but an SVG filter can, where it's allowed on the
// backdrop. Measured values, by the backdrop's luminance from black to white.
const DARK_BRIGHTNESS = [32, 59, 83, 102, 117, 126, 129, 128, 121].map((level) => level / 255);
const DARK_COLOUR = [1.27, 1.19, 1.11, 1.03, 0.95, 0.87, 0.79, 0.71, 0.63];
const COLOUR_RANGE = 1.3;
let darkReady = false;

function installDarkCurve(): void {
  if (darkReady) return;
  darkReady = true;
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
  const gain = DARK_COLOUR.map((value) => value / COLOUR_RANGE);
  const filter = svg("filter", { id: "liquidglass-dark", "color-interpolation-filters": "sRGB" });
  filter.append(
    svg("feColorMatrix", { in: "SourceGraphic", values: `${r} ${g} ${b} 0 0 ${r} ${g} ${b} 0 0 ${r} ${g} ${b} 0 0 0 0 0 1 0`, result: "luminance" }),
    table(DARK_BRIGHTNESS, "brightness"),
    table(gain, "gain"),
    table(gain.map((value) => 0.5 * (1 - value)), "offset"),
    // Colour as a difference from grey, held around 0.5 because filters can't go below zero.
    svg("feColorMatrix", { in: "SourceGraphic", values: `${row(0)} 0 0.5 ${row(1)} 0 0.5 ${row(2)} 0 0.5 0 0 0 1 0`, result: "colour" }),
    svg("feComposite", { in: "colour", in2: "gain", operator: "arithmetic", k1: 1, result: "scaled" }),
    svg("feComposite", { in: "scaled", in2: "offset", operator: "arithmetic", k2: 1, k3: 1, result: "centred" }),
    svg("feComposite", { in: "centred", in2: "brightness", operator: "arithmetic", k2: 2, k3: 1, k4: -1 }),
  );
  container().append(filter);
  document.documentElement.style.setProperty("--lg-svg-dark", 'url("#liquidglass-dark")');
}

function fit(element: HTMLElement, selection: boolean, filtered: boolean): void {
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  if (!width || !height) return;
  const style = getComputedStyle(element);
  const corner = style.borderTopLeftRadius;
  const radius = Math.min(
    width / 2,
    height / 2,
    corner.endsWith("%") ? (Math.min(width, height) * parseFloat(corner)) / 100 : parseFloat(corner),
  );
  const length = (name: string) => {
    const value = parseFloat(style.getPropertyValue(name));
    return Number.isFinite(value) ? value : undefined;
  };
  const shape = {
    bezel: length("--lg-bezel"),
    thickness: length("--lg-thickness"),
    blur: 15.3 - 14 * clamp(((length("--lg-transparency") ?? 0.5) - 0.5) * 2, 0, 1),
    level: length("--lg-refraction") ?? 1,
    zoom: Math.max(1, length("--lg-zoom") ?? 1),
    shine: Math.max(0, length("--lg-shine") ?? 1),
  };
  const { filter, rim } = lens(width, height, radius, selection, shape);
  if (filtered) {
    element.style.setProperty("--lg-filter", filter);
    if (!selection) element.style.setProperty("--lg-lens-blur", "0px");
    if (refractsBackdrop()) installDarkCurve();
    // The curve is regular glass's. Clearer glass stays on the tone.
    if ((length("--lg-transparency") ?? 0.5) > 0.5) element.style.setProperty("--lg-curve", "initial");
    else element.style.removeProperty("--lg-curve");
  }
  element.style.setProperty("--lg-rim", rim);
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
function refract(element: HTMLElement, selection: boolean, filtered: boolean): () => void {
  let cancel: (() => void) | undefined;
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
    element.style.removeProperty("--lg-curve");
    element.style.removeProperty("--lg-rim");
  };
}

/** The rim alone, kept fitted as the element changes size. */
export const fitRim = (element: HTMLElement): (() => void) => refract(element, false, false);

/** The lens for an element at its final size, where the browser can run it. Stop it before the size changes. */
export function fitLens(element: HTMLElement): () => void {
  if (!refractsBackdrop()) return () => {};
  fit(element, false, true);
  return () => {
    element.style.removeProperty("--lg-filter");
    element.style.removeProperty("--lg-lens-blur");
    element.style.removeProperty("--lg-curve");
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
