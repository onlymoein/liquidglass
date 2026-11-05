// webkit.cjs <light|dark> <out.png> <query>: desktop WebKit, and what it made of the copy layer.
const { webkit } = require("/Users/studio/Developer/Momentra/web/node_modules/playwright-core");
(async () => {
  const [mode, out, query] = process.argv.slice(2);
  const b = await webkit.launch();
  const p = await (await b.newContext({ viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, colorScheme: mode })).newPage();
  p.on("pageerror", (e) => console.error(String(e)));
  await p.goto(`http://localhost:8765/index.html?${query}`); await p.waitForTimeout(1500);
  console.log(await p.evaluate(() => { const l = document.querySelector(".lg-glass-copy"); return l ? { inline: l.style.filter.slice(0, 200), computed: getComputedStyle(l).filter.slice(0, 200), size: l.getBoundingClientRect().width, child: !!l.querySelector("img,div div") } : "no copy layer"; }));
  await p.screenshot({ path: out }); await b.close();
})();
