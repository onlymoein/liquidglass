export interface RoundedRect {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

// How far a point is from a rounded rectangle: negative inside.
function distanceTo(rect: RoundedRect, px: number, py: number): number {
  const qx = Math.abs(px - rect.x - rect.width / 2) - rect.width / 2 + rect.radius;
  const qy = Math.abs(py - rect.y - rect.height / 2) - rect.height / 2 + rect.radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rect.radius;
}

// The shapes' distance fields, blended where they come within `spacing` of each
// other, which is what makes neighbouring glass flow together.
export function blended(rects: RoundedRect[], spacing: number, px: number, py: number): number {
  let field = Infinity;
  for (const rect of rects) {
    const next = distanceTo(rect, px, py);
    const h = Math.max(spacing - Math.abs(field - next), 0) / (spacing || 1);
    field = Math.min(field, next) - (h * h * spacing) / 4;
  }
  return field;
}

/** The outline of the blended shapes, as an SVG path, by marching squares. */
export function outline(rects: RoundedRect[], spacing: number, width: number, height: number, step = 2): string {
  const columns = Math.ceil(width / step) + 1;
  const rows = Math.ceil(height / step) + 1;
  const field = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      field[row * columns + column] = blended(rects, spacing, column * step, row * step);
    }
  }
  const at = (column: number, row: number) => field[row * columns + column]!;
  // Where the outline crosses each cell edge, named by the edge, so that the
  // segments of neighbouring cells join up.
  const point = (a: number, b: number, column: number, row: number, across: boolean): [number, number] => {
    const t = a / (a - b);
    return across ? [(column + t) * step, row * step] : [column * step, (row + t) * step];
  };
  const next = new Map<string, string>();
  const points = new Map<string, [number, number]>();
  const edge = (column: number, row: number, across: boolean) => {
    const key = `${column},${row},${across ? 1 : 0}`;
    if (!points.has(key)) {
      const a = at(column, row);
      const b = across ? at(column + 1, row) : at(column, row + 1);
      points.set(key, point(a, b, column, row, across));
    }
    return key;
  };
  for (let row = 0; row < rows - 1; row++) {
    for (let column = 0; column < columns - 1; column++) {
      const a = at(column, row) < 0;
      const b = at(column + 1, row) < 0;
      const c = at(column + 1, row + 1) < 0;
      const d = at(column, row + 1) < 0;
      if (a === b && b === c && c === d) continue;
      const top = () => edge(column, row, true);
      const right = () => edge(column + 1, row, false);
      const bottom = () => edge(column, row + 1, true);
      const left = () => edge(column, row, false);
      // Each segment runs with the inside on one hand, so outlines chain up.
      const link = (from: string, to: string) => next.set(from, to);
      const code = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0);
      switch (code) {
        case 1: link(bottom(), left()); break;
        case 2: link(right(), bottom()); break;
        case 3: link(right(), left()); break;
        case 4: link(top(), right()); break;
        case 5: link(top(), left()); link(bottom(), right()); break;
        case 6: link(top(), bottom()); break;
        case 7: link(top(), left()); break;
        case 8: link(left(), top()); break;
        case 9: link(bottom(), top()); break;
        case 10: link(left(), bottom()); link(right(), top()); break;
        case 11: link(right(), top()); break;
        case 12: link(left(), right()); break;
        case 13: link(bottom(), right()); break;
        case 14: link(left(), bottom()); break;
      }
    }
  }
  let path = "";
  const seen = new Set<string>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    let key: string | undefined = start;
    let first = true;
    while (key && !seen.has(key)) {
      seen.add(key);
      const [x, y] = points.get(key)!;
      path += `${first ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      first = false;
      key = next.get(key);
    }
    path += "Z";
  }
  return path;
}
