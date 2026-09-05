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
 *
 * ⚠️ Ne čekaj da dugme „Prijavite se” nestane. Dok prijava traje, obrazac mu
 * menja natpis u „Prijava...”, pa taj uslov postane tačan odmah po kliku —
 * pre nego što NextAuth uopšte odgovori. Sledeći `goto` tada krene bez
 * kolačića sesije, proxy ispravno vrati na `/login`, a zahtev u letu se
 * prekine (`ECONNRESET` u dnevniku servera). Čeka se odgovor NextAuth-a, pa
 * stvarni odlazak sa `/login`.
 */

setup("administrator se prijavljuje i pamti sesiju", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel("Email adresa").fill(ADMIN_EMAIL);
  await page.getByLabel("Lozinka", { exact: true }).fill(ADMIN_LOZINKA);

  // Čekanje se postavlja PRE klika: odgovor nosi `Set-Cookie` sa sesijom i ne
  // sme da promakne. `signIn` sa `redirect: false` pogađa ovu rutu.
  const prijava = page.waitForResponse(
    (odgovor) => odgovor.url().includes("/api/auth/callback/credentials"),
    { timeout: 30_000 },
  );
  await page.getByRole("button", { name: "Prijavite se" }).click();
  expect((await prijava).ok()).toBe(true);

  // Odbijeni podaci takođe vraćaju 200, samo sa greškom u telu, pa se ishod
  // čita sa ekrana. Poređenje kroz `poll` daje čitljiv razlog pada („odbijeno”)
  // umesto anonimnog isteka vremena.
  await expect
    .poll(
      async () => {
        if (!new URL(page.url()).pathname.startsWith("/login")) {
          return "prijavljen";
        }
        const greske = await page
          .getByText("Neispravan email ili lozinka")
          .count();
        return greske > 0 ? "odbijeno" : "ceka";
      },
      { timeout: 30_000 },
    )
    .toBe("prijavljen");

  // Dokaz da je sesija zaista administratorska, pre nego što je snimimo.
  // `ok()` sam po sebi nije dovoljan: preusmerenje na `/login` se takođe
  // završava statusom 200, pa adresa mora da se proveri zasebno.
  const odgovor = await page.goto("/admin");
  expect(odgovor?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/admin$/);

  await page.context().storageState({ path: PUTANJA_ADMIN_STANJA });
});
