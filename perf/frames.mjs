// Loads the built demo in Chrome and scrolls it, timing every frame and every task that holds
// up the page. Glass does its heavy work off the page's thread, so nothing it does should hold
// the page up: the check fails if, while scrolling, the page is held up for long. Frame times
// are reported but not judged, since a machine with no graphics card draws slowly whatever.
//
//   npm run demo:build && node perf/frames.mjs
//
// Chrome is found at CHROME_PATH, or where macOS and Linux install it.
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import puppeteer from "puppeteer-core";

const ROOT = new URL("../demo/dist/", import.meta.url).pathname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".jpg": "image/jpeg", ".png": "image/png", ".mp4": "video/mp4", ".svg": "image/svg+xml" };
/** The most the page may be held up by long tasks while it scrolls, in milliseconds. */
const MOST_HELD_UP = 100;

const chrome =
  process.env.CHROME_PATH ??
  ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find(existsSync);
if (!chrome) throw new Error("No Chrome found. Set CHROME_PATH.");

const server = createServer((request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, "http://x").pathname)).replace(/^\/+/, "") || "index.html";
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file)) return response.writeHead(404).end();
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox", "--window-size=1280,900"] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(url, { waitUntil: "load" });
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const result = await page.evaluate(async () => {
    const frames = [];
    const held = [];
    new PerformanceObserver((list) => list.getEntries().forEach((entry) => held.push(entry.duration))).observe({ type: "longtask" });
    let last = performance.now();
    let running = true;
    const tick = (time) => {
      frames.push(time - last);
      last = time;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const end = document.documentElement.scrollHeight - innerHeight;
    const start = performance.now();
    await new Promise((done) => {
      const step = () => {
        const progress = (performance.now() - start) / 4000;
        scrollTo(0, Math.abs(Math.sin(progress * Math.PI)) * end);
        if (progress < 1) requestAnimationFrame(step);
        else done();
      };
      step();
    });
    running = false;
    frames.shift();
    frames.sort((a, b) => a - b);
    const at = (share) => frames[Math.floor(frames.length * share)] ?? 0;
    return { frames: frames.length, median: at(0.5), p99: at(0.99), slow: frames.filter((frame) => frame > 33.4).length, heldUp: held.reduce((sum, d) => sum + d, 0) };
  });
  const ms = (value) => `${Math.round(value * 10) / 10} ms`;
  console.log(`Frames: ${result.frames}, median ${ms(result.median)}, slowest 1% ${ms(result.p99)}, over 33 ms: ${result.slow}`);
  console.log(`Held up by long tasks while scrolling: ${ms(result.heldUp)} (the most allowed is ${MOST_HELD_UP} ms)`);
  if (result.heldUp > MOST_HELD_UP) process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
