import { defineConfig } from "tsup";

export default defineConfig({
  // One export: the viewer is deliberately a single front door.
  //
  //   "footprint-viewer" → ./dist/index.{js,cjs}
  //
  // The package owns the config reader, the validation sentences, the one
  // cursor, the tab strip and the slot plumbing. Every pixel beyond that
  // comes from the lens libraries it arranges — which is why they are all
  // external below.
  entry: {
    index: "src/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  // Peer deps must NOT be bundled — consumers provide them (the lens family
  // rule: bundling a copy gives a consumer two instances at runtime, and
  // brand/instanceof checks silently fail across them). `agentthinkingui`
  // is the OPTIONAL peer: it stays external so the lazy `import()` in
  // src/story/loadStoryModule.ts resolves against the CONSUMER's install —
  // absent there, the import rejects and the Story tab renders its
  // teaching card instead of crashing any build.
  external: [
    "react",
    "react-dom",
    /^agentfootprint-lens(\/|$)/,
    /^agentfootprint(\/|$)/,
    /^agentthinkingui(\/|$)/,
    /^footprintjs(\/|$)/,
    "footprint-explainable-ui",
  ],
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
