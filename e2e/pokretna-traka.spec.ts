import { expect, test } from "@playwright/test";

/**
 * Pokretna traka i WCAG 2.2.2.
 *
 * Kriterijum traži da se kretanje duže od pet sekundi može zaustaviti vidljivim
 * mehanizmom. `stopOnInteraction` i pauza na hover ga NE ispunjavaju: hover ne
 * postoji na dodirnom ekranu, a tastatura ga ne pokreće. Ova provera zato tvrdi
 * da dugme postoji, da nosi stanje i da stvarno zaustavlja animaciju.
 */
test("pokretna traka ima dugme za pauzu koje zaista zaustavlja kretanje", async ({
  page,
}) => {
  const odgovor = await page.goto("/");
  expect(odgovor?.ok()).toBe(true);

  const traka = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "E2E traka" }) });
  await expect(traka).toBeVisible();

  const pokretno = traka.locator(".animate-marquee");
  await expect(pokretno).toHaveCSS("animation-play-state", "running");

  const dugme = traka.getByRole("button", { name: "Pauziraj pokretnu traku" });
  await expect(dugme).toBeVisible();
  await expect(dugme).toHaveAttribute("aria-pressed", "false");

  await dugme.click();

  await expect(pokretno).toHaveCSS("animation-play-state", "paused");
  await expect(
    traka.getByRole("button", { name: "Pokreni pokretnu traku" }),
  ).toHaveAttribute("aria-pressed", "true");
});
