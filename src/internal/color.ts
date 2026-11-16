/** A colour: red, green and blue from 0 to 255, and opacity from 0 to 1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Hue from 0 to 360, saturation and value from 0 to 1, and opacity from 0 to 1. */
export interface Hsva {
  h: number;
  s: number;
  v: number;
  a: number;
}

// Only hex is accepted, and only these exact shapes. What reaches the page's styles is always
// rebuilt from the numbers read here, never from the string that was passed in.
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Reads `#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`. Anything else is null. */
export function parseColor(input: unknown): Rgba | null {
  if (typeof input !== "string") return null;
  const text = input.trim();
  if (!HEX.test(text)) return null;
  let hex = text.slice(1);
  if (hex.length <= 4) hex = [...hex].map((digit) => digit + digit).join("");
  const byte = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return { r: byte(0), g: byte(2), b: byte(4), a: hex.length === 8 ? Math.round((byte(6) / 255) * 100) / 100 : 1 };
}

const pair = (value: number): string => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");

/** `#rrggbb`, or `#rrggbbaa` when it's see-through and `alpha` allows it. */
export function formatColor({ r, g, b, a }: Rgba, alpha = true): string {
  const base = `#${pair(r)}${pair(g)}${pair(b)}`;
  return alpha && a < 1 ? base + pair(a * 255) : base;
}

/** Something a style can take, built from numbers alone. */
export function cssColor({ r, g, b, a }: Rgba): string {
  return `rgb(${Math.round(clamp(r, 0, 255))} ${Math.round(clamp(g, 0, 255))} ${Math.round(clamp(b, 0, 255))} / ${Math.round(clamp(a, 0, 1) * 100) / 100})`;
}

export function rgbToHsv({ r, g, b, a }: Rgba): Hsva {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  let h = 0;
  if (delta > 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max, a };
}

export function hsvToRgb({ h, s, v, a }: Hsva): Rgba {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const val = clamp(v, 0, 1);
  const f = (n: number) => {
    const k = (n + hue / 60) % 6;
    return (val - val * sat * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return { r: Math.round(f(5)), g: Math.round(f(3)), b: Math.round(f(1)), a };
}

/**
 * The spectrum: hue across, and down it white, then the full colour, then black. Saturation
 * climbs and value stays at its top for the upper half; value falls for the lower.
 */
export function spectrumAt(x: number, y: number): { h: number; s: number; v: number } {
  const down = clamp(y, 0, 1);
  return { h: clamp(x, 0, 1) * 360, s: Math.min(1, down * 2), v: Math.min(1, (1 - down) * 2) };
}

/** Where on the spectrum a colour is: the nearest point, for a colour that isn't on it. */
export function spectrumOf({ h, s, v }: Hsva): { x: number; y: number } {
  return { x: clamp(h, 0, 360) / 360, y: v >= s ? s / 2 : 1 - v / 2 };
}

export const GRID_COLUMNS = 10;
export const GRID_ROWS = 12;

/** The grid: a row of greys, then a row for each lightness, every column a hue. */
export function gridColors(): string[] {
  const colors: string[] = [];
  for (let column = 0; column < GRID_COLUMNS; column++) {
    const grey = 1 - column / (GRID_COLUMNS - 1);
    colors.push(formatColor(hsvToRgb({ h: 0, s: 0, v: grey, a: 1 })));
  }
  for (let row = 1; row < GRID_ROWS; row++) {
    // From pale to deep, passing the full colour a third of the way down.
    const along = row / (GRID_ROWS - 1);
    const s = along < 0.35 ? 0.15 + (along / 0.35) * 0.85 : 1;
    const v = along < 0.35 ? 1 : 1 - ((along - 0.35) / 0.65) * 0.65;
    for (let column = 0; column < GRID_COLUMNS; column++) {
      colors.push(formatColor(hsvToRgb({ h: (column / GRID_COLUMNS) * 360, s, v, a: 1 })));
    }
  }
  return colors;
}
