import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./__tests__/worker.ts",
      miniflare: {
        compatibilityDate: "2026-08-04",
        compatibilityFlags: ["nodejs_compat"],
        durableObjects: {
          TEAM: { className: "TeamDurableObject", useSQLite: true },
          KERNEL_USER: { className: "KernelPasswordUser", useSQLite: true },
          PENDING_LOGIN: { className: "PendingLogin", useSQLite: true },
        },
      },
    }),
  ],
  test: { include: ["__tests__/*.test.ts"] },
});
