import { expect, test } from "@playwright/test";

test("mobilni kupac prolazi katalog, korpu i checkout", async ({ page }) => {
  const response = await page.goto("/catalog");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["content-security-policy"]).toContain(
    "default-src 'self'",
  );
  await expect(page.getByRole("heading", { name: "Katalog" })).toBeVisible();

  await page
    .getByRole("link", { name: "E2E test proizvod", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "E2E test proizvod" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Univerzalna" }).click();
  await page.getByRole("button", { name: "Dodaj u korpu" }).click();
  await page.getByRole("link", { name: "Pregled korpe" }).click();

  await expect(page.getByRole("heading", { name: "Korpa (1)" })).toBeVisible();
  await page.getByRole("link", { name: "Nastavi na plaćanje" }).click();
  await expect(page.getByRole("heading", { name: "Plaćanje" })).toBeVisible();

  const submit = page.getByRole("button", { name: "Potvrdi narudžbinu" });
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(
    page.getByRole("heading", { name: "Proverite označena polja" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email *")).toBeFocused();

  await page.getByLabel("Email *").fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel("Telefon *").fill("0601234567");
  await page.getByLabel("Ime *").fill("E2E");
  await page.getByLabel("Prezime *").fill("Kupac");
  await page.getByLabel("Ulica i kućni broj *").fill("Test ulica 1");
  await page.getByLabel("Grad *").fill("Beograd");
  await page.getByLabel("Poštanski broj *").fill("11000");
  await page
    .getByRole("checkbox", { name: /uslove korišćenja/i })
    .check();

  await submit.click();
  await expect(page).toHaveURL(/\/order\/success\?oid=/, { timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: "Hvala na porudžbini!" }),
  ).toBeVisible();
});
