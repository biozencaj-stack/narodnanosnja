import { expect, test } from "@playwright/test";

/**
 * Blok proizvoda na početnoj.
 *
 * Ova provera postoji zbog jedne tvrdnje: sekcija NE pamti cenu. Zasejana
 * konfiguracija bloka nosi samo izvor `snizeno` — nijedan broj. Ako se ovde
 * vidi tačna snižena cena, znači da je pročitana sa servera pri prikazu.
 * Da se cena ikad zapiše u `config`, ovaj test bi i dalje prolazio odmah posle
 * seed-a, ali bi pao čim se cena promeni — zato se tvrdi i puna i snižena, i
 * izračunat procenat, koje sekcija nema odakle da zna.
 */
test("blok proizvoda prikazuje cenu sa servera, ne iz konfiguracije", async ({
  page,
}) => {
  const odgovor = await page.goto("/");
  expect(odgovor?.ok()).toBe(true);

  const blok = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "E2E sniženo" }) });
  await expect(blok).toBeVisible();

  const kartica = blok.getByRole("article").filter({
    has: page.getByRole("link", { name: "E2E sniženi proizvod", exact: true }),
  });
  await expect(kartica).toBeVisible();

  await expect(kartica.getByText("2.500 RSD", { exact: true })).toBeVisible();
  await expect(kartica.getByText("4.000 RSD", { exact: true })).toBeVisible();
  await expect(kartica.getByText("−38%", { exact: true })).toBeVisible();

  // Proizvod bez sniženja ne sme da uđe u blok sa izvorom `snizeno`.
  await expect(
    blok.getByRole("link", { name: "E2E test proizvod", exact: true }),
  ).toHaveCount(0);
});
