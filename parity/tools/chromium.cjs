// chromium.cjs <light|dark> <out.png> <query>: the same page at the same size in Chromium.
const { chromium } = require("/Users/studio/Developer/Momentra/web/node_modules/playwright-core");
(async () => {
  const [mode, out, query] = process.argv.slice(2);
  // Real GPU compositing: the headless software renderer draws sharp stripes along the right and bottom of any backdrop blur.
  const b = await chromium.launch({ channel: "chromium", headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] });
  const p = await (await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, colorScheme: mode })).newPage();
  p.on("pageerror", (e) => console.error(String(e)));
  await p.goto(`file://${require("path").resolve(__dirname, "../.build/web/index.html")}?${query}`); await p.waitForTimeout(1500);
  await p.screenshot({ path: out }); await b.close();
})();
