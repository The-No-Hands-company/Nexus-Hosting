import { defineConfig, devices } from "@playwright/test";

/**
 * Federated Hosting — Playwright E2E test configuration.
 *
 * Tests run against a real running stack. Set FH_BASE_URL to point at
 * your dev or staging environment before running.
 *
 * Usage:
 *   pnpm exec playwright install --with-deps
 *   FH_BASE_URL=http://localhost:8080 pnpm exec playwright test
 */

const BASE_URL = process.env.FH_BASE_URL ?? "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // federation tests have ordering dependencies
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
  ],

  // Global timeout — federation tests may do real HTTP calls
  timeout: 30_000,
  expect: { timeout: 10_000 },
});
