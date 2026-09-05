import { expect, test } from "@playwright/test";

/**
 * Zone sekcija na stranicama izvan početne.
 *
 * Dve tvrdnje se proveravaju zajedno, jer jedna bez druge ne znači ništa:
 * zona se pojavljuje tamo gde je admin postavio, i NE pojavljuje se drugde.
 * Da `pageKey` negde procuri, prva bi i dalje prolazila.
 */
test("zona kataloga se vidi na katalogu, a ne na početnoj", async ({ page }) => {
  const katalog = await page.goto("/catalog");
  expect(katalog?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "E2E zona kataloga" }),
  ).toBeVisible();

  const pocetna = await page.goto("/");
  expect(pocetna?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { name: "E2E zona kataloga" }),
  ).toHaveCount(0);
});

test("404 prikazuje admin sadržaj i i dalje vraća HTTP 404", async ({ page }) => {
  const odgovor = await page.goto("/adresa-koje-nema-2026");

  // Status je važniji od sadržaja: da sekcije promene odgovor na 200,
  // pretraživači bi svaku pogrešnu adresu tretirali kao ispravnu stranicu.
  expect(odgovor?.status()).toBe(404);

  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "E2E zona 404" })).toBeVisible();
});
