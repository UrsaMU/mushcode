import { defineConfig } from "tsup";

export default defineConfig({
  entry: { node: "node.ts" },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  // Bundle everything — avoids Deno-style .ts import resolution issues in Node
  bundle: true,
  // Use explicit .cjs/.mjs extensions so package.json exports map correctly
  outExtension({ format }) {
    return { js: format === "cjs" ? ".cjs" : ".mjs" };
  },
  // Skip type-check here; deno check covers the source
  skipNodeModulesBundle: false,
});
