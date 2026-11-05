// Sweeps flat colours under Chromium's glass; prints the same lines as colors.sh.
const { chromium } = require("/Users/studio/Developer/Momentra/web/node_modules/playwright-core");
const { execFileSync } = require("child_process"); const path = require("path");
const page = `file://${path.resolve(__dirname, "../.build/web/index.html")}`;
const out = path.resolve(__dirname, "../.build/s/cc.png"), sample = path.resolve(__dirname, "../.build/sample");
const colours = "000000 202020 404040 606060 808080 a0a0a0 c0c0c0 e0e0e0 ffffff ff0000 00ff00 0000ff ffff00 ff00ff 00ffff ff9500 5856d6 34c759".split(" ");
(async () => {
  const b = await chromium.launch();
  for (const mode of ["light", "dark"]) {
    const p = await (await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, colorScheme: mode })).newPage();
    for (const bg of colours) {
      await p.goto(`${page}?bg=${bg}&kind=regular`); await p.waitForTimeout(700);
      await p.screenshot({ path: out });
      console.log(mode, "chromium", "regular", bg, execFileSync(sample, [out, "mean", "503", "860", "200", "80"]).toString().trim());
    }
  }
  await b.close();
})();
