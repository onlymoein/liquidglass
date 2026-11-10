import { painter, type Paint, type Painter, type PaintJob } from "./paint";

// Glass's maps and rims are worked out a pixel at a time, which on a phone takes long enough to
// hold up the page. So they're worked out in a worker, off the page's thread, and come back as
// images; the glass takes them up when they arrive, and draws without them until then. Where a
// worker can't run, as under a security policy that won't allow one made like this, they're
// worked out on the page instead, when it's idle. Either way each is made once and kept.

export interface Painted {
  /** Each image as a data URL, in the order the painter gives them. */
  urls: string[];
  maximum?: number;
  reach?: number;
}

/** The painter on the page: for its helpers, and for work a worker can't do. */
export const local: Painter = painter();

// What the worker runs: the same painter, then each image drawn to a canvas and encoded.
const WORKER = `
const work = (${painter.toString()})();
self.onmessage = async (event) => {
  const { id, job } = event.data;
  try {
    const out = work[job.kind](...job.args);
    const blobs = [];
    for (const picture of out.images) {
      const canvas = new OffscreenCanvas(picture.width, picture.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2d context");
      context.putImageData(new ImageData(picture.data, picture.width, picture.height), 0, 0);
      blobs.push(await canvas.convertToBlob({ type: "image/png" }));
    }
    self.postMessage({ id, blobs, maximum: out.maximum, reach: out.reach });
  } catch (error) {
    self.postMessage({ id, error: String(error) });
  }
};
`;

type Waiting = { job: PaintJob; resolve: (painted: Painted | null) => void };

let worker: Worker | null | undefined;
let next = 0;
const waiting = new Map<number, Waiting>();

function readAsUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function whenIdle(callback: () => void): void {
  if (typeof requestIdleCallback === "function") requestIdleCallback(callback, { timeout: 500 });
  else setTimeout(callback, 50);
}

/** The work done on the page, at once, for a browser or a page that won't run a worker. */
function paintHere(job: PaintJob): Painted | null {
  try {
    const out = (local[job.kind] as (...args: unknown[]) => Paint)(...job.args);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    // Without a canvas there's nothing to bend by, and the glass stays as CSS draws it.
    if (!context) return null;
    const urls = out.images.map((picture) => {
      canvas.width = picture.width;
      canvas.height = picture.height;
      const pixels = context.createImageData(picture.width, picture.height);
      pixels.data.set(picture.data);
      context.putImageData(pixels, 0, 0);
      return canvas.toDataURL();
    });
    return { urls, maximum: out.maximum, reach: out.reach };
  } catch {
    return null;
  }
}

/** Work a worker took and couldn't finish, done on the page when it's idle. */
function onPage(job: PaintJob, resolve: (painted: Painted | null) => void): void {
  whenIdle(() => resolve(paintHere(job)));
}

/** Hands whatever was waiting on the worker to the page, once the worker can't be used. */
function giveUpOnWorker(): void {
  worker?.terminate();
  worker = null;
  const left = [...waiting.values()];
  waiting.clear();
  for (const { job, resolve } of left) onPage(job, resolve);
}

function start(): Worker | null {
  if (worker !== undefined) return worker;
  worker = null;
  if (typeof Worker !== "function" || typeof OffscreenCanvas !== "function" || typeof Blob !== "function") return null;
  try {
    const url = URL.createObjectURL(new Blob([WORKER], { type: "text/javascript" }));
    const made = new Worker(url);
    made.onmessage = async (event: MessageEvent<{ id: number; blobs?: Blob[]; error?: string; maximum?: number; reach?: number }>) => {
      const { id, blobs, error, maximum, reach } = event.data;
      const entry = waiting.get(id);
      if (!entry) return;
      waiting.delete(id);
      // A browser whose worker can't draw, as Safari before 16.4 can't, does it on the page.
      if (error || !blobs) return onPage(entry.job, entry.resolve);
      try {
        entry.resolve({ urls: await Promise.all(blobs.map(readAsUrl)), maximum, reach });
      } catch {
        onPage(entry.job, entry.resolve);
      }
    };
    // A policy that forbids the worker shows up here rather than as a thrown error.
    made.onerror = (event) => {
      event.preventDefault();
      giveUpOnWorker();
    };
    worker = made;
  } catch {
    worker = null;
  }
  return worker;
}

function paint(job: PaintJob): Promise<Painted | null> {
  return new Promise((resolve) => {
    const running = start();
    if (!running) return onPage(job, resolve);
    const id = next++;
    waiting.set(id, { job, resolve });
    running.postMessage({ id, job });
  });
}

const done = new Map<string, Painted | null>();
const pending = new Map<string, (() => void)[]>();

/**
 * What `job` paints, if it's been painted: null if it couldn't be, undefined if it's still to
 * come, in which case it's started and `ready` is called once it arrives.
 */
export function painted(key: string, job: PaintJob, ready?: () => void): Painted | null | undefined {
  if (done.has(key)) return done.get(key);
  // With no worker, it's done here and now, as it always was.
  if (!pending.has(key) && !start()) {
    const result = paintHere(job);
    done.set(key, result);
    return result;
  }
  const callbacks = pending.get(key);
  if (callbacks) {
    if (ready) callbacks.push(ready);
    return undefined;
  }
  pending.set(key, ready ? [ready] : []);
  void paint(job).then((result) => {
    done.set(key, result);
    const waiters = pending.get(key) ?? [];
    pending.delete(key);
    for (const callback of waiters) callback();
  });
  return undefined;
}
