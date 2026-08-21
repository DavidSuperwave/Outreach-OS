import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      main: "./__tests__/worker.ts",
      miniflare: {
        compatibilityDate: "2026-08-04",
        compatibilityFlags: ["nodejs_compat"],
        durableObjects: {
          TASK_SLICE: { className: "TaskSliceDurableObject", useSQLite: true },
          TEAM: { className: "TeamDurableObject", useSQLite: true },
          USER: { className: "UserDurableObject", useSQLite: true },
        },
      },
    }),
  ],
  test: { include: ["__tests__/*.test.ts"] },
});
