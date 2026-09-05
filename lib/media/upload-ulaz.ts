/**
 * Provera ulaza pri otpremanju slike.
 *
 * Stoji pod `lib/` da bi je `npm test` uopšte pokrenuo: skripta glob-uje
 * isključivo `lib/**\/*.test.ts`. Funkcija je čista — ne dodiruje disk, mrežu
 * ni `sharp` — pa se svaka granica proverava bez podizanja servera.
 */

import {
  jeDozvoljenMime,
  profilZaFolder,
  type ProfilObrade,
} from "./profili";

export type RazlogOdbijanja =
  | "NEMA_FAJLA"
  | "NEPOZNAT_FOLDER"
  | "NEDOZVOLJEN_TIP"
  | "PREVELIK"
  | "PRAZAN";

export type IshodUlaza =
  | { ok: true; profil: ProfilObrade }
  | { ok: false; razlog: RazlogOdbijanja; poruka: string; status: 400 | 413 };

export interface OpisFajla {
  type: unknown;
  size: unknown;
}

function megabajti(bajtova: number): string {
  return `${(bajtova / 1_048_576).toFixed(bajtova < 1_048_576 ? 2 : 0)} MB`;
}

export function proveriUlazUploada(
  fajl: OpisFajla | null | undefined,
  folder: unknown,
): IshodUlaza {
  const profil = profilZaFolder(folder);
  if (!profil) {
    return {
      ok: false,
      razlog: "NEPOZNAT_FOLDER",
      poruka: "Nepoznata fascikla za otpremanje.",
      status: 400,
    };
  }

  if (!fajl) {
    return {
      ok: false,
      razlog: "NEMA_FAJLA",
      poruka: "Nijedan fajl nije poslat.",
      status: 400,
    };
  }

  if (!jeDozvoljenMime(fajl.type)) {
    return {
      ok: false,
      razlog: "NEDOZVOLJEN_TIP",
      poruka: "Dozvoljene su samo slike: JPEG, PNG, WebP, GIF ili AVIF.",
      status: 400,
    };
  }

  if (typeof fajl.size !== "number" || !Number.isFinite(fajl.size)) {
    return {
      ok: false,
      razlog: "PRAZAN",
      poruka: "Veličina fajla nije poznata.",
      status: 400,
    };
  }

  if (fajl.size <= 0) {
    return {
      ok: false,
      razlog: "PRAZAN",
      poruka: "Fajl je prazan.",
      status: 400,
    };
  }

  if (fajl.size > profil.maxBajtova) {
    // 413, ne 400: klijentu treba da bude jasno da je problem veličina, a ne
    // oblik zahteva. Poruka nosi i granicu, jer se sada razlikuje po fascikli.
    return {
      ok: false,
      razlog: "PREVELIK",
      poruka: `Fajl je prevelik. Za „${profil.folder}” granica je ${megabajti(profil.maxBajtova)}.`,
      status: 413,
    };
  }

  return { ok: true, profil };
}
