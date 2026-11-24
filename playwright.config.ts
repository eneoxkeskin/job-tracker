import { defineConfig, devices } from "@playwright/test";

// End-to-end tests (PLAN.md §8, V5) against a production build: run `npm run build` first.
// Signs in through "Try demo" (e2e/helpers.ts), so no OAuth mocking is needed.
// The database is DATABASE_URL: the Neon dev branch locally, a Postgres container in CI.

const PORT = 3200;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // `next start` runs in production mode, where Auth.js only trusts the Host header when
    // told to (Vercel sets this automatically). Local test server only.
    env: { AUTH_TRUST_HOST: "true" },
  },
});
