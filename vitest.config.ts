import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests target pure domain logic only (money, rates, plan math, geo).
// No DOM, no network, no database: fast and deterministic.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
