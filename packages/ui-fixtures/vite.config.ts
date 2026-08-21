import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  resolve: {
    alias: {
      // Don't externalize node built-ins - they shouldn't be imported at all
    },
  },
  optimizeDeps: {
    exclude: [
      // Exclude packages that have node-only code
      "control-plane",
      "connectivity",
      "authz",
      "identity",
      "registry",
      "soup",
    ],
  },
});
