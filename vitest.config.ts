import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // The lens family's dist imports reach a real stylesheet
    // (@xyflow/react/dist/style.css). Externalized packages load through
    // plain Node, which cannot read .css — inline them so Vite's pipeline
    // (which understands CSS) processes the chain instead.
    server: {
      deps: {
        inline: [
          "agentfootprint-lens",
          "footprint-explainable-ui",
          "@xyflow/react",
          "agentthinkingui",
        ],
      },
    },
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Same posture as agentfootprint-lens: retry transient failures on loaded
    // runners so a flaky run doesn't block a release; a genuinely broken test
    // still fails all attempts.
    retry: 2,
  },
});
