import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "yarn dev --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: {
      PASSES_E2E_FIXTURES: "1",
      PASSES_E2E_PURCHASE_FIXTURE: "1",
      PASSES_E2E_DIST_DIR: "1",
      NEXT_PUBLIC_EVENT_PASS_ENVIRONMENT: "local",
    },
  },
});
