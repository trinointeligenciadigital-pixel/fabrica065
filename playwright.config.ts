import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

const localEnv = loadEnv("development", process.cwd(), "");
process.env.CLERK_PUBLISHABLE_KEY ??= localEnv.VITE_CLERK_PUBLISHABLE_KEY;
process.env.CLERK_SECRET_KEY ??= localEnv.CLERK_SECRET_KEY;
process.env.E2E_ADMIN_EMAIL ??= localEnv.E2E_ADMIN_EMAIL;

const authenticatedReady = Boolean(
  process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY && process.env.E2E_ADMIN_EMAIL,
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://127.0.0.1:5176",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5176",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: authenticatedReady
    ? [
        { name: "clerk-setup", testMatch: /authenticated\.setup\.ts/ },
        {
          name: "public-chromium",
          use: { ...devices["Desktop Chrome"] },
          testIgnore: /authenticated\.(setup|spec)\.ts/,
        },
        {
          name: "authenticated-chromium",
          use: { ...devices["Desktop Chrome"], storageState: "playwright/.clerk/admin.json" },
          dependencies: ["clerk-setup"],
          testMatch: /authenticated\.spec\.ts/,
        },
      ]
    : [
        {
          name: "public-chromium",
          use: { ...devices["Desktop Chrome"] },
          testIgnore: /authenticated\.(setup|spec)\.ts/,
        },
      ],
});
