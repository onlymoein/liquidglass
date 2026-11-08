// What a held tab lens shows bends at its rim, as iOS 27's does: near the rim
// it draws what lies further in, so labels stretch out to the edge, and on a
// dark page the colours part, red furthest out.
//
// The filter goes on the lens's own copy of the labels rather than on the
// backdrop, so it works in every browser, Safari included. It's fixed to the
// lens and the labels move under it, so it's made once for each size.
//
// The maps are greys, one for each direction: Chrome converts a map's colours
// to a wide-gamut display's before displacing by them, which would bend a
// pull across sideways, but greys come through unchanged. WebKit draws an SVG
// filter on HTML in bounding-box units, so every filter here is in them, and
// each direction gets its own pass with its own scale.

const SVG = "http://www.w3.org/2000/svg";

/** How far in, in px, the rim reaches for what it shows at its very edge. */
export const BEND_REACH = 7;
/** How wide the band round the rim that bends is, in px. */
export const BEND_BAND = 15;
/** How much further red bends than green, and blue less, as a share of the bend. */
export const BEND_SPLIT = 0.14;
/** How far, in px, what the rim bends is softened, as iOS softens it. */
export const BEND_BLUR = 0.9;
/** The bend grows with the lift in this many steps. Each is a filter of its own. */
export const BEND_STEPS = 8;

const filters = new Map<string, string[]>();
let defs: SVGDefsElement | undefined;

function svg(name: string, attributes: Record<string, string | number>): SVGElement {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function container(): SVGDefsElement {
  if (defs?.isConnected) return defs;
  const root = svg("svg", { width: 0, height: 0, "aria-hidden": "true" });
  root.style.cssText = "position:absolute;width:0;height:0;pointer-events:none";
  defs = svg("defs", {}) as SVGDefsElement;
  root.append(defs);
  document.body.append(root);
  return defs;
}

/** The maps for a capsule: how far each point reaches in, across and down, and where it bends at all. */
function maps(width: number, height: number): [string, string, string] | null {
  const density = Math.min(devicePixelRatio || 1, 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width * density));
  canvas.height = Math.max(1, Math.ceil(height * density));
  const context = canvas.getContext("2d");
  // Without a canvas there's nothing to bend by, and the labels stay as they are.
  if (!context) return null;
  const across = context.createImageData(canvas.width, canvas.height);
  const down = context.createImageData(canvas.width, canvas.height);
  const rim = context.createImageData(canvas.width, canvas.height);
  const radius = Math.min(width, height) / 2;

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
      // Steepest at the rim and easing to nothing at the band's inner edge.
      const t = clamp01(1 - Math.max(distance, 0) / BEND_BAND);
      const reach = t * t;
      const i = (y * canvas.width + x) * 4;
      // Each point draws from further in, so the map points inward.
      const gx = Math.round(127.5 - nx * reach * 127.5);
      const gy = Math.round(127.5 - ny * reach * 127.5);
      across.data.fill(gx, i, i + 3);
      across.data[i + 3] = 255;
      down.data.fill(gy, i, i + 3);
      down.data[i + 3] = 255;
      rim.data[i + 3] = Math.round(t * 255);
    }
  }

  context.putImageData(across, 0, 0);
  const a = canvas.toDataURL();
  context.putImageData(down, 0, 0);
  const d = canvas.toDataURL();
  context.putImageData(rim, 0, 0);
  return [a, d, canvas.toDataURL()];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** WebKit draws an SVG filter on HTML only in bounding-box units. */
const boxUnits = (): boolean => /AppleWebKit\//.test(navigator.userAgent) && !/Chrom(?:e|ium)\//.test(navigator.userAgent);

/**
 * Filters that bend the rim of a capsule `width` by `height`, from barely to
 * fully, one for each step of the lift. Index 0 is the first step, not none.
 */
export function bendFilters(width: number, height: number, dark: boolean): string[] {
  const w = Math.round(width * 2) / 2;
  const h = Math.round(height * 2) / 2;
  const key = `${w}x${h}${dark ? "-dark" : ""}`;
  const cached = filters.get(key);
  if (cached) return cached;

  const drawn = maps(w, h);
  if (!drawn) return [];
  const [across, down, band] = drawn;
  const result: string[] = [];
  const base = `liquidglass-bend-${filters.size}`;
  // On a light page labels are dark ink, which has no colour to part: it only blurs.
  const rays = dark
    ? ([
        ["r", 1 + BEND_SPLIT, "1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"],
        ["g", 1, "0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0"],
        ["b", 1 - BEND_SPLIT, "0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0"],
      ] as const)
    : ([["all", 1, ""]] as const);

  const box = boxUnits();
  const unit = box ? "objectBoundingBox" : "userSpaceOnUse";
  const place = box ? { x: 0, y: 0, width: 1, height: 1 } : { x: 0, y: 0, width: w, height: h };
  for (let step = 1; step <= BEND_STEPS; step++) {
    const id = `${base}-${step}`;
    const filter = svg("filter", {
      id,
      ...place,
      filterUnits: unit,
      primitiveUnits: unit,
      "color-interpolation-filters": "sRGB",
    });
    filter.append(
      svg("feImage", { href: across, ...place, preserveAspectRatio: "none", result: "across-map" }),
      svg("feImage", { href: down, ...place, preserveAspectRatio: "none", result: "down-map" }),
      svg("feImage", { href: band, ...place, preserveAspectRatio: "none", result: "band" }),
    );
    // Each pull, with an alpha of one half, which is no pull, for the direction it doesn't
    // pull in. Set here rather than in the image, which would store its grey premultiplied.
    for (const pull of ["across", "down"]) {
      const half = svg("feComponentTransfer", { in: `${pull}-map`, result: pull });
      half.append(svg("feFuncA", { type: "linear", slope: 0, intercept: 0.5 }));
      filter.append(half);
    }
    const reach = (BEND_REACH * 2 * step) / BEND_STEPS;
    for (const [name, factor, values] of rays) {
      filter.append(
        svg("feDisplacementMap", {
          in: "SourceGraphic",
          in2: "across",
          scale: box ? (reach * factor) / w : reach * factor,
          xChannelSelector: "R",
          yChannelSelector: "A",
          result: `${name}-x`,
        }),
        svg("feDisplacementMap", {
          in: `${name}-x`,
          in2: "down",
          scale: box ? (reach * factor) / h : reach * factor,
          xChannelSelector: "A",
          yChannelSelector: "R",
          result: values ? `${name}-ray` : "bent",
        }),
      );
      if (values) filter.append(svg("feColorMatrix", { in: `${name}-ray`, type: "matrix", values, result: name }));
    }
    if (dark) {
      // Each colour from its own ray. Over black, which a dark page is taken to be, adding
      // them gives exactly the labels as the split light would draw them.
      filter.append(
        svg("feComposite", { in: "r", in2: "g", operator: "arithmetic", k2: 1, k3: 1, result: "rg" }),
        svg("feComposite", { in: "rg", in2: "b", operator: "arithmetic", k2: 1, k3: 1, result: "bent" }),
      );
    }
    // Softened where it bends, and as sharp as ever where it doesn't. The displacement
    // samples the nearest pixel, which leaves stair-steps the blur also smooths.
    const blur = BEND_BLUR * (step / BEND_STEPS);
    filter.append(
      svg("feGaussianBlur", { in: "bent", stdDeviation: box ? `${blur / w} ${blur / h}` : blur, result: "soft" }),
      svg("feComposite", { in: "soft", in2: "band", operator: "in", result: "soft-rim" }),
      svg("feComposite", { in: "bent", in2: "band", operator: "out", result: "sharp-middle" }),
      svg("feComposite", { in: "soft-rim", in2: "sharp-middle", operator: "arithmetic", k2: 1, k3: 1 }),
    );
    container().append(filter);
    result.push(`url("#${id}")`);
  }

  filters.set(key, result);
  return result;
}
