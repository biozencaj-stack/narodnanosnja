import { expect, test } from "@playwright/test";
import { PRAZNO_STANJE } from "./fixtures/admin-stanje";

/**
 * Provera samog harnesa, ne admin funkcionalnosti.
 *
 * Postoji da bi kasnije faze nasledile DOKAZAN mehanizam prijave, a ne
 * obećanje: ako prijava ili čuvanje sesije puknu, pada ovaj test, a ne test
 * neke sekcije koji bi izgledao kao da je funkcionalnost pokvarena.
 */

test.describe("harnes za admin ekrane", () => {
  test("prijavljen administrator otvara kontrolnu tablu", async ({ page }) => {
    const odgovor = await page.goto("/admin");

    expect(odgovor?.ok()).toBe(true);
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("link", { name: "Nazad na sajt" }),
    ).toBeVisible();
  });

  test("sesija administratora radi i posle prelaska na drugi admin ekran", async ({
    page,
  }) => {
    await page.goto("/admin/orders");

    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(page.getByRole("link", { name: "Porudžbine" })).toBeVisible();
  });
});

test.describe("bez prijave", () => {
  test.use({ storageState: PRAZNO_STANJE });

  test("anoniman posetilac ne vidi admin, nego prijavu", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    await expect(page.getByRole("heading", { name: "Prijavite se" })).toBeVisible();
  });

  test("anoniman zahtev ka admin API-ju dobija 401, ne sadržaj", async ({
    request,
  }) => {
    const odgovor = await request.get("/api/admin/settings");

    expect(odgovor.status()).toBe(401);
    expect(await odgovor.json()).toMatchObject({ error: "Prijava je obavezna." });
  });
});
