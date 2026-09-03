import { expect, test as setup } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_LOZINKA,
  PUTANJA_ADMIN_STANJA,
} from "./admin-stanje";

/**
 * Prijava administratora, jednom po pokretanju.
 *
 * Ovaj fajl NIJE spec: podrazumevani `testMatch` traži `*.spec.ts`, pa ga
 * pokreće samo projekat `setup-admin` iz `playwright.config.ts`. Prijava ide
 * kroz stvarni obrazac, ne ubacivanjem kolačića — tako provera pokriva i
 * NextAuth tok, a ne samo admin ekran.
 *
 * Nalog dolazi iz `scripts/seed-e2e.ts`, iza istog guarda kao ostatak seed-a.
 */

setup("administrator se prijavljuje i pamti sesiju", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email adresa").fill(ADMIN_EMAIL);
  await page.getByLabel("Lozinka", { exact: true }).fill(ADMIN_LOZINKA);
  await page.getByRole("button", { name: "Prijavite se" }).click();

  // Prijava vodi na početnu; čekamo da nestane obrazac, ne fiksni tajmer.
  await expect(page.getByRole("button", { name: "Prijavite se" })).toHaveCount(0, {
    timeout: 20_000,
  });

  // Dokaz da je sesija zaista administratorska, pre nego što je snimimo.
  const odgovor = await page.goto("/admin");
  expect(odgovor?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/admin$/);

  await page.context().storageState({ path: PUTANJA_ADMIN_STANJA });
});
