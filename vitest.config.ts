import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" path alias from tsconfig.json.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // Every suite covers pure config/layout/export logic, so no DOM is needed.
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
