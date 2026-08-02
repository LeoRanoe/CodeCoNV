import { defineConfig } from "@playwright/test";

const baseURL = process.env.CODECO_E2E_BASE_URL ?? "http://127.0.0.1:3000";
const reuseExistingServer = process.env.CODECO_E2E_REUSE_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/report" }]],
  outputDir: "test-results/artifacts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    // Google Chrome is the browser the client uses, so it stays the default. A container
    // that only has Playwright's own build (CI, this repository's dev image) sets
    // CODECO_E2E_CHANNEL=chromium and, if needed, the path to that build.
    channel: process.env.CODECO_E2E_CHANNEL ?? "chrome",
    launchOptions: process.env.CODECO_E2E_BROWSER_PATH
      ? { executablePath: process.env.CODECO_E2E_BROWSER_PATH }
      : {},
    locale: "en-US",
    timezoneId: "America/Paramaribo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-field",
      use: {
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: "desktop-office",
      use: {
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        hasTouch: false,
        isMobile: false,
      },
    },
  ],
  webServer: reuseExistingServer
    ? undefined
    : {
        command: "npm run dev",
        url: `${baseURL}/supervisie`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
