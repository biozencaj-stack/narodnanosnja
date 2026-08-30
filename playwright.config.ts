import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 3107);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NEXTAUTH_URL: baseURL,
      NEXT_PUBLIC_SITE_URL: baseURL,
      NEXTAUTH_SECRET: "e2e-nextauth-secret-with-at-least-32-bytes",
      ORDER_ACCESS_SECRET: "e2e-order-access-secret",
      NEXT_PUBLIC_DEFAULT_COUNTRY: "Srbija",
      NEXT_PUBLIC_CASH_ON_DELIVERY_ENABLED: "true",
      NEXT_PUBLIC_CARD_PAYMENTS_ENABLED: "false",
      NEXT_PUBLIC_CHAT_ENABLED: "false",
      NEXT_PUBLIC_NEWSLETTER_ENABLED: "false",
      NEXT_PUBLIC_REVIEWS_ENABLED: "false",
    },
  },
});
