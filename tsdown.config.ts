import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { transform } from "lightningcss";
import { defineConfig, type UserConfig } from "tsdown";

// The parts' order, read from where the components take it. The config is loaded by Node, which
// won't import TypeScript, so the names are read out of the file.
const ORDER = [...readFileSync("src/styles/order.ts", "utf8").matchAll(/^\s+"([a-z-]+)",$/gm)].map((match) => match[1]!);

// Bundles `./styles.css?inline` as a minified string, as Vite does, so the
// components can insert their own styles.
const targets = { safari: 16 << 16, chrome: 111 << 16, firefox: 113 << 16 };

const inlineCss = {
  name: "inline-css",
  resolveId(source: string, importer: string | undefined) {
    if (source.endsWith(".css?inline") && importer) return resolve(dirname(importer), source);
  },
  load(id: string) {
    if (!id.endsWith(".css?inline")) return;
    const file = id.slice(0, -"?inline".length);
    // Naming the browsers keeps -webkit-backdrop-filter, which Safari needed until 18.
    const { code } = transform({ filename: file, code: readFileSync(file), minify: true, targets });
    return `export default ${JSON.stringify(code.toString())};`;
  },
};

// The whole stylesheet, for an app that would rather import it than have each component bring its
// own part: the parts joined in their order.
const wholeStylesheet = {
  name: "whole-stylesheet",
  generateBundle(this: { emitFile(file: { type: "asset"; fileName: string; source: string }): void }) {
    const source = ORDER.map((name) => readFileSync(resolve("src/styles", `${name}.css`), "utf8")).join("\n");
    this.emitFile({ type: "asset", fileName: "styles.css", source });
  },
};

const config: UserConfig = defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  platform: "neutral",
  dts: true,
  hash: false,
  plugins: [inlineCss, wholeStylesheet],
  banner: ({ fileName }) => (/^index\.c?js$/.test(fileName) ? '"use client";' : undefined),
});

export default config;
