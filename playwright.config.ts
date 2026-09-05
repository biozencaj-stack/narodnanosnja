import { defineConfig, devices } from "@playwright/test";
import { PUTANJA_ADMIN_STANJA } from "./e2e/fixtures/admin-stanje";

const port = Number(process.env.E2E_PORT || 3107);
const baseURL = `http://127.0.0.1:${port}`;

/** Sve provere admin ekrana; voze se samo na desktop projektu, iza prijave. */
const ADMIN_SPECOVI = /admin-.*\.spec\.ts$/;

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
      // Jednom se prijavi kroz stvarni obrazac i snimi sesiju na disk.
      name: "setup-admin",
      testMatch: /fixtures[\\/]admin\.ts$/,
    },
    {
      // Zatečeni projekat ostaje netaknut: isti uređaj, isti tok kupovine.
      // Admin specovi se izuzimaju jer ovaj projekat nema prijavljenu sesiju.
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testIgnore: ADMIN_SPECOVI,
    },
    {
      // Admin panel je dvokolonski desktop obrazac; na Pixel 7 širini se ne
      // proverava ono što administrator zaista vidi.
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"], storageState: PUTANJA_ADMIN_STANJA },
      dependencies: ["setup-admin"],
      testMatch: ADMIN_SPECOVI,
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
      // Demo režim blokira svaki API upis; admin tokovi u njemu ne rade, pa se
      // isključuje izričito umesto da se oslanja na odsustvo promenljive.
      DEMO_MODE: "false",
    },
  },
});
