import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests run against a real database (the Neon `dev` branch from .env).
// Never point DATABASE_URL at production when running them.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
