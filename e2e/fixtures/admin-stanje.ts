/**
 * Konstante harnesa za admin ekrane.
 *
 * Namerno bez ijednog `test`/`setup` poziva: ovaj fajl uvozi i
 * `playwright.config.ts`, a Playwright ne dozvoljava prijavu testa dok se
 * konfiguracija učitava.
 */

/** Snimljena sesija administratora. Kredencijal — nikad u git. */
export const PUTANJA_ADMIN_STANJA = "e2e/.auth/admin.json";

/** Prazno stanje za provere koje moraju da se dogode bez prijave. */
export const PRAZNO_STANJE: { cookies: []; origins: [] } = {
  cookies: [],
  origins: [],
};

/** Isti nalog koji pravi `scripts/seed-e2e.ts`, iza istog guarda. */
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "e2e-admin@example.com";
export const ADMIN_LOZINKA = process.env.E2E_ADMIN_PASSWORD ?? "E2eAdmin!2026";
