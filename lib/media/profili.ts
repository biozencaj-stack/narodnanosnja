/**
 * Profili obrade otpremljenih slika.
 *
 * Jedan folder = jedan profil. Granice se razlikuju jer se razlikuje i namena:
 * hero slika se prikazuje preko cele širine ekrana i 800 px je za nju premalo,
 * dok kartica proizvoda od 2000 px ne dobija ništa osim težine.
 *
 * Modul je namerno bez uvoza `sharp`-a, Prisme i Next-a: isto ograničenje
 * čita i serverska ruta i test, a test ne sme da povuče ceo runtime.
 */

export interface ProfilObrade {
  /** Ime foldera u `public/uploads/`. */
  folder: string;
  /** Najveća dozvoljena veličina ULAZNOG fajla, u bajtovima. */
  maxBajtova: number;
  /** Najveće dimenzije posle obrade; slika se uklapa unutra, bez uvećavanja. */
  maxSirina: number;
  maxVisina: number;
  /**
   * Kvalitet WebP-a. Vrednost mora ostati u `[70, 75]`: ispod 70 se na tkaninama
   * i vezu vide artefakti kompresije, iznad 75 fajl raste bez vidljive razlike.
   */
  kvalitet: number;
}

/** Dozvoljeni opseg kvaliteta. Vidi napomenu uz `kvalitet`. */
export const MIN_KVALITETA = 70;
export const MAX_KVALITETA = 75;

const PROFILI: Record<string, ProfilObrade> = {
  // Zatečeni folderi ostaju na starim granicama. Njihovo podizanje bi bez
  // potrebe povećalo postojeće slike i promenilo izgled stranica koje su
  // podešene prema ovim dimenzijama.
  products: { folder: "products", maxBajtova: 1_048_576, maxSirina: 800, maxVisina: 800, kvalitet: 75 },
  articles: { folder: "articles", maxBajtova: 1_048_576, maxSirina: 800, maxVisina: 800, kvalitet: 75 },
  categories: { folder: "categories", maxBajtova: 1_048_576, maxSirina: 800, maxVisina: 800, kvalitet: 75 },
  brands: { folder: "brands", maxBajtova: 1_048_576, maxSirina: 800, maxVisina: 800, kvalitet: 75 },

  // Novi folderi za sekcije stranica.
  "sekcije-hero": { folder: "sekcije-hero", maxBajtova: 4_194_304, maxSirina: 2000, maxVisina: 1200, kvalitet: 75 },
  "sekcije-kartica": { folder: "sekcije-kartica", maxBajtova: 1_048_576, maxSirina: 800, maxVisina: 800, kvalitet: 75 },
  "sekcije-ikona": { folder: "sekcije-ikona", maxBajtova: 262_144, maxSirina: 256, maxVisina: 256, kvalitet: 75 },
};

export const DOZVOLJENI_FOLDERI = Object.freeze(Object.keys(PROFILI));

export function profilZaFolder(folder: unknown): ProfilObrade | null {
  if (typeof folder !== "string") return null;
  return PROFILI[folder] ?? null;
}

/**
 * MIME tipovi koje uopšte pokušavamo da otvorimo.
 *
 * Ovo NIJE dokaz da je fajl slika: `file.type` u `FormData` postavlja klijent i
 * može da laže. Stvarna provera je to što `sharp` mora da pročita zaglavlje i
 * vrati dimenzije; ovaj spisak samo odbija očigledno pogrešan ulaz pre nego što
 * se uopšte troši procesor.
 */
export const DOZVOLJENI_MIME = Object.freeze([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export function jeDozvoljenMime(vrednost: unknown): boolean {
  return typeof vrednost === "string" && DOZVOLJENI_MIME.includes(vrednost);
}
