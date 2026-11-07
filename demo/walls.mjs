// Draws the site's wallpapers: marbled colour with fine veins, because glass only
// shows what it does when there's detail behind it. Needs ffmpeg.
//
//   node demo/walls.mjs
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WIDTH = 2000;
const HEIGHT = 1250;
const here = dirname(fileURLToPath(import.meta.url));

const hex = (value) => [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16));

const WALLS = {
  flow: { seed: 7, scale: 1.05, veins: 16, vein: [255, 236, 214], veinStrength: 0.22, colours: ["#10207e", "#2a3be0", "#7a2fe6", "#e0338f", "#ff7a45"].map(hex) },
  dusk: { seed: 23, scale: 0.95, veins: 14, vein: [255, 190, 130], veinStrength: 0.2, colours: ["#04071e", "#0b1b52", "#31196f", "#7c1f6e", "#d9593d"].map(hex) },
  dawn: { seed: 41, scale: 1, veins: 16, vein: [255, 255, 255], veinStrength: 0.5, colours: ["#8fc7ff", "#bcb6ff", "#f3b4d8", "#ffc9b0", "#ffe7b8"].map(hex) },
};

function noiseField(seed) {
  const size = 256;
  const table = new Float32Array(size * size);
  let state = seed * 2654435761 >>> 0;
  for (let i = 0; i < table.length; i++) {
    state = (Math.imul(state ^ (state >>> 15), 2246822519) + 3266489917) >>> 0;
    table[i] = state / 4294967296;
  }
  const at = (x, y) => table[((y & 255) << 8) | (x & 255)];
  const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const noise = (x, y) => {
    const [fx, fy] = [Math.floor(x), Math.floor(y)];
    const [u, v] = [smooth(x - fx), smooth(y - fy)];
    const top = at(fx, fy) + (at(fx + 1, fy) - at(fx, fy)) * u;
    const bottom = at(fx, fy + 1) + (at(fx + 1, fy + 1) - at(fx, fy + 1)) * u;
    return top + (bottom - top) * v;
  };
  return (x, y) => {
    let [total, amplitude, frequency] = [0, 0.5, 1];
    for (let octave = 0; octave < 4; octave++) {
      total += amplitude * noise(x * frequency, y * frequency);
      amplitude *= 0.42;
      frequency *= 2.02;
    }
    return total;
  };
}

function draw({ seed, scale, veins, vein, veinStrength, colours }) {
  const fbm = noiseField(seed);
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 3);
  let grain = seed;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const [px, py] = [(x / HEIGHT) * scale, (y / HEIGHT) * scale];
      const [qx, qy] = [fbm(px, py), fbm(px + 5.2, py + 1.3)];
      const [rx, ry] = [fbm(px + 2.6 * qx + 1.7, py + 2.6 * qy + 9.2), fbm(px + 2.6 * qx + 8.3, py + 2.6 * qy + 2.8)];
      const field = fbm(px + 2.6 * rx, py + 2.6 * ry);

      // One run through the colours, not a cycle, so they lie in broad fields.
      const place = Math.max(0, Math.min(0.9999, (field - 0.24) / 0.46)) * (colours.length - 1);
      const low = Math.floor(place);
      const blend = place - low;
      const mix = blend * blend * (3 - 2 * blend);
      const from = colours[low];
      const to = colours[low + 1];

      const wave = Math.abs(((field * veins) % 1) - 0.5) * 2;
      const line = Math.max(0, 1 - wave / 0.05) * veinStrength;

      grain = (Math.imul(grain, 1664525) + 1013904223) >>> 0;
      const speck = (grain / 4294967296 - 0.5) * 3;
      const i = (y * WIDTH + x) * 3;
      for (let c = 0; c < 3; c++) {
        const base = from[c] + (to[c] - from[c]) * mix;
        pixels[i + c] = Math.max(0, Math.min(255, Math.round(base + (vein[c] - base) * line + speck)));
      }
    }
  }
  return pixels;
}

for (const [name, wall] of Object.entries(WALLS)) {
  const out = resolve(here, "public", `${name}.jpg`);
  const encoder = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", `${WIDTH}x${HEIGHT}`, "-i", "-", "-frames:v", "1", "-q:v", "6", out], { stdio: ["pipe", "inherit", "inherit"] });
  encoder.stdin.end(draw(wall));
  await new Promise((done, failed) => encoder.on("close", (code) => (code ? failed(new Error(`ffmpeg ${code}`)) : done())));
  console.log(out);
}
