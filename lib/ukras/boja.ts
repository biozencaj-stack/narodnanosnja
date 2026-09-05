/**
 * Provera boje koja završava unutar `data:` URI-ja sa SVG šarom.
 *
 * Šare i trake iz `components/ukras` crtaju se kao SVG upakovan u
 * `background-image: url('data:image/svg+xml,...')`. Taj SVG je zaseban
 * dokument: **CSS promenljive iz stranice u njemu ne postoje**. Vrednost poput
 * `var(--color-zlatna)` tamo nije boja nego neispravan paint, pa linija sa
 * `stroke` nestane, a oblik sa `fill` padne na crno. Greška ne prijavljuje
 * ništa — šara se jednostavno ne vidi kako treba.
 *
 * Zato se ovde propušta samo doslovan HEX; sve ostalo pada na podrazumevanu
 * vrednost. Funkcija stoji pod `lib/` da bi je `npm test` uopšte pokrenuo:
 * skripta glob-uje isključivo `lib/**\/*.test.ts`.
 */

const HEKS_BOJA = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function jeHeksBoja(vrednost: unknown): vrednost is string {
  return typeof vrednost === "string" && HEKS_BOJA.test(vrednost);
}

/**
 * Vraća boju upotrebljivu unutar `data:` URI-ja, ili podrazumevanu vrednost.
 *
 * U razvoju dodatno javlja u konzoli, da se pogrešna vrednost primeti odmah, a
 * ne tek kad neko pogleda podnožje i pita zašto traka nema boju.
 */
export function sigurnaBoja(vrednost: unknown, podrazumevana: string): string {
  if (jeHeksBoja(vrednost)) return vrednost;

  if (vrednost !== undefined && process.env.NODE_ENV === "development") {
    console.warn(
      `Šara prima samo HEX boju; „${String(vrednost)}“ ne postoji unutar data: URI-ja. ` +
        `Koristi se ${podrazumevana}.`,
    );
  }

  return podrazumevana;
}
