import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
import { normalizujSekciju } from "@/lib/sekcije/validacija";
import { podrazumevanRaspored, type SekcijaZaPrikaz } from "@/lib/sekcije/podrazumevani-raspored";
import { tipSekcije } from "@/lib/sekcije/registar";
import { KOMPONENTE_SEKCIJA } from "./mapa";

/**
 * Renderuje raspored jedne stranice.
 *
 * Tri pravila koja se ne smeju izgubiti pri kasnijim izmenama:
 *
 * 1. SVAKA asinhrona sekcija ide u SOPSTVENI `Suspense`, sa kosturom iz
 *    registra. Bez toga se sekcije serijalizuju i stranica prestaje da strimuje
 *    — a finalni snimak ekrana izgleda isto, pa se regresija ne primeti.
 * 2. `try/catch` stoji UNUTAR te granice, u samoj komponenti sekcije. Jedna
 *    pokvarena sekcija renderuje ništa; stranica ostaje.
 * 3. Nepoznat `kind` se preskače uz upozorenje. To je normalno stanje posle
 *    vraćanja koda unazad, kad podaci znaju za tip koji kod još nema.
 */

function Kostur({ vrsta }: { vrsta: "mrezaProizvoda" | "mrezaKartica" }) {
  if (vrsta === "mrezaProizvoda") {
    return (
      <section className="bg-background py-14 lg:py-20">
        <div className="container-wide">
          <ProductGridSkeleton count={4} />
        </div>
      </section>
    );
  }
  return null;
}

function JednaSekcija({
  sekcija,
  jezik,
}: {
  sekcija: SekcijaZaPrikaz;
  jezik: string;
}) {
  const tip = tipSekcije(sekcija.kind);
  if (!tip) {
    console.warn(`Nepoznat tip sekcije, preskačem: ${sekcija.kind}`);
    return null;
  }

  const Komponenta = KOMPONENTE_SEKCIJA[sekcija.kind];
  if (!Komponenta) {
    console.warn(`Tip sekcije nema komponentu, preskačem: ${sekcija.kind}`);
    return null;
  }

  const config = normalizujSekciju(sekcija.kind, sekcija.config);

  // Okvir renderuje sama komponenta. Kad sekcija nema šta da prikaže, ne sme
  // da ostane prazan `section` sa razmakom — to bi bio vidljiv procep na
  // stranici tamo gde danas nema ničega.
  const telo = <Komponenta config={config} jezik={jezik} />;

  if (!tip.asinhrona) return telo;

  return (
    <Suspense fallback={tip.kostur ? <Kostur vrsta={tip.kostur} /> : null}>
      {telo}
    </Suspense>
  );
}

export async function RenderSekcije({ pageKey }: { pageKey: string }) {
  const jezik = await getLocale();
  const sekcije = podrazumevanRaspored(pageKey);

  return (
    <>
      {sekcije.map((sekcija) => (
        <JednaSekcija key={sekcija.id} sekcija={sekcija} jezik={jezik} />
      ))}
    </>
  );
}
