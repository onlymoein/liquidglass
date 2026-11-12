// Loads the built demo in Chrome and scrolls it, timing every frame and every task that holds
// up the page. Glass does its heavy work off the page's thread, so nothing it does should hold
// the page up: the check fails if, while scrolling, the page is held up for long. Frame times
// are reported but not judged, since a machine with no graphics card draws slowly whatever.
//
// Then the same in Firefox's way, which Chrome is told it is: the phone's content is marked as
// the backdrop, so glass bends a copy of it. The copy is grown by 400 rows, and the backdrop
// restyled, and neither may hold the page up for long. Last, the window is dragged narrower a
// few pixels at a time, and the lenses left behind afterwards must be few.
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
/** The most lenses that may be added by dragging the window narrower: what the glass is now drawn with, and the few kept. */
const MOST_LENSES_LEFT = 40;
const FIREFOX = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:133.0) Gecko/20100101 Firefox/133.0";

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
const ms = (value) => `${Math.round(value * 10) / 10} ms`;
const fail = (message) => {
  console.log(`FAIL: ${message}`);
  process.exitCode = 1;
};

async function open({ firefox = false } = {}) {
  const page = await browser.newPage();
  if (firefox) {
    await page.setUserAgent(FIREFOX);
    await page.evaluateOnNewDocument(() => {
      new MutationObserver(() => {
        const scroller = document.querySelector(".phone-scroll");
        if (scroller && !scroller.hasAttribute("data-liquidglass-backdrop")) scroller.setAttribute("data-liquidglass-backdrop", "");
      }).observe(document, { childList: true, subtree: true });
    });
  }
  await page.evaluateOnNewDocument(() => {
    window.__held = [];
    new PerformanceObserver((list) => list.getEntries().forEach((entry) => window.__held.push(entry.duration))).observe({ type: "longtask" });
  });
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(url, { waitUntil: "load" });
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return page;
}

// Scrolls `target` (the page, or the phone's own scroller) for four seconds.
async function scroll(page, target) {
  return page.evaluate(async (target) => {
    const frames = [];
    window.__held = [];
    let last = performance.now();
    let running = true;
    const tick = (time) => {
      frames.push(time - last);
      last = time;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const scroller = target ? document.querySelector(target) : document.scrollingElement;
    const end = scroller.scrollHeight - scroller.clientHeight;
    const start = performance.now();
    await new Promise((done) => {
      const step = () => {
        const progress = (performance.now() - start) / 4000;
        scroller.scrollTop = Math.abs(Math.sin(progress * Math.PI)) * end;
        if (progress < 1) requestAnimationFrame(step);
        else done();
      };
      step();
    });
    running = false;
    frames.shift();
    frames.sort((a, b) => a - b);
    const at = (share) => frames[Math.floor(frames.length * share)] ?? 0;
    return { frames: frames.length, median: at(0.5), p99: at(0.99), slow: frames.filter((frame) => frame > 33.4).length, heldUp: window.__held.reduce((sum, d) => sum + d, 0) };
  }, target);
}

function report(name, result) {
  console.log(`${name}: ${result.frames} frames, median ${ms(result.median)}, slowest 1% ${ms(result.p99)}, over 33 ms: ${result.slow}`);
  console.log(`${name}: held up by long tasks ${ms(result.heldUp)} (the most allowed is ${MOST_HELD_UP} ms)`);
  if (result.heldUp > MOST_HELD_UP) fail(`${name} held the page up`);
}

try {
  const page = await open();
  report("Chrome, scrolling the page", await scroll(page));

  // Dragging the window narrower: every size it passes through could leave a lens behind.
  const lenses = () => page.evaluate(() => document.querySelectorAll('filter[id^="liquidglass"]').length);
  const before = await lenses();
  for (let width = 1280; width >= 760; width -= 8) {
    await page.setViewport({ width, height: 900 });
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const after = await lenses();
  console.log(`Chrome, dragging the window narrower: ${before} lenses before, ${after} after (at most ${MOST_LENSES_LEFT} more allowed)`);
  if (after - before > MOST_LENSES_LEFT) fail("resizing left lenses behind");
  await page.close();

  const copied = await open({ firefox: true });
  const copies = await copied.evaluate(() => document.querySelectorAll(".lg-glass-copy").length);
  if (!copies) fail("no glass copied the marked backdrop");
  report("Firefox's copy, scrolling the phone", await scroll(copied, ".phone-scroll"));
  const changed = await copied.evaluate(async () => {
    const settle = () => new Promise((resolve) => setTimeout(resolve, 1500));
    window.__held = [];
    const page = document.querySelector(".phone-page");
    const rows = document.createDocumentFragment();
    for (let i = 0; i < 400; i++) {
      const row = document.createElement("div");
      row.textContent = `Row ${i}`;
      rows.append(row);
    }
    page.append(rows);
    await settle();
    document.querySelector(".phone-scroll").classList.add("lg-perf-restyled");
    await settle();
    return { heldUp: window.__held.reduce((sum, d) => sum + d, 0), copied: [...document.querySelectorAll(".lg-glass-copy")].reduce((n, copy) => n + copy.querySelectorAll("*").length, 0) };
  });
  console.log(`Firefox's copy, growing the backdrop to ${changed.copied} copied elements and restyling it: held up ${ms(changed.heldUp)} (the most allowed is ${MOST_HELD_UP} ms)`);
  if (changed.heldUp > MOST_HELD_UP) fail("copying the backdrop held the page up");
} finally {
  await browser.close();
  server.close();
}
