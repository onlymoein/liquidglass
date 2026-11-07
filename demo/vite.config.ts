import { defineConfig } from "vite";

// Served from onlymoein.github.io/liquidglass/.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: 0 },
});
