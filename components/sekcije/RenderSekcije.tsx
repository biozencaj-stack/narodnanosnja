import { Suspense } from "react";
import { getLocale } from "next-intl/server";
import { ProductGridSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { normalizujSekciju } from "@/lib/sekcije/validacija";
import { citajNacrtSekcija, citajObjavljeneSekcije } from "@/lib/db/sekcije";
import { podrazumevanRaspored, type SekcijaZaPrikaz } from "@/lib/sekcije/podrazumevani-raspored";
import { tipJeDostupan, tipSekcije } from "@/lib/sekcije/registar";
import { storeCapabilities } from "@/lib/config/capabilities";
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

/**
 * Rezervni sadržaj dok se asinhrona sekcija učitava.
 *
 * Postoji da stranica ne poskoči kad sekcija stigne. `mrezaKartica` je ranije
 * vraćala `null`, pa je taj kostur bio samo deklaracija bez ijednog piksela —
 * sekcija bi se pojavila niotkuda i gurnula sve ispod sebe.
 */
function Kostur({ vrsta }: { vrsta: "mrezaProizvoda" | "mrezaKartica" | "tekstualni" }) {
  if (vrsta === "mrezaProizvoda") {
    return (
      <section className="bg-background py-14 lg:py-20">
        <div className="container-wide">
          <ProductGridSkeleton count={4} />
        </div>
      </section>
    );
  }

  if (vrsta === "mrezaKartica") {
    return (
      <section className="bg-background py-14 lg:py-20" aria-hidden="true">
        <div className="container-wide grid grid-cols-2 gap-4 md:grid-cols-3 lg:gap-6">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-background py-10 lg:py-14" aria-hidden="true">
      <div className="container-wide space-y-3">
        <Skeleton className="h-6 w-1/3 rounded" />
        <Skeleton className="h-4 w-full rounded" />
        <Skeleton className="h-4 w-2/3 rounded" />
      </div>
    </section>
  );
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

  // Prekidač se može ugasiti POSLE dodavanja sekcije. Tada sekcija ostaje u
  // bazi i vidljiva je u admin panelu, ali se na sajtu ne renderuje — obrazac
  // za prijavu bi inače slao u rutu koje nema.
  if (!tipJeDostupan(sekcija.kind, storeCapabilities as unknown as Record<string, boolean>)) {
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

/**
 * Dok baza nema nijednu objavljenu sekciju za stranicu, renderuje se ugrađeni
 * raspored iz `podrazumevani-raspored.ts`.
 *
 * To je NAMERNO privremeno stanje i jedina tačka u kojoj postoje dve istine o
 * početnoj. Postoji zato što se migracija na produkciju primenjuje ručno i pre
 * objave koda: bez ovog povratka, između primene migracije i prvog „Objavi”
 * početna bi bila prazna stranica. Gašenje ovog povratka je stavka faze 3 i
 * uslovljeno je upitom nad produkcijom koji potvrdi da redovi postoje.
 */
async function ucitajSekcije(
  pageKey: string,
  nacrt: boolean,
): Promise<SekcijaZaPrikaz[]> {
  const izBaze = nacrt
    ? await citajNacrtSekcija(pageKey)
    : await citajObjavljeneSekcije(pageKey);

  if (izBaze.length > 0) {
    return izBaze.map((red) => ({
      id: red.id,
      kind: red.kind,
      config: red.config as Record<string, unknown>,
    }));
  }

  return podrazumevanRaspored(pageKey);
}

export async function RenderSekcije({
  pageKey,
  nacrt = false,
}: {
  pageKey: string;
  nacrt?: boolean;
}) {
  const jezik = await getLocale();
  const sekcije = await ucitajSekcije(pageKey, nacrt);

  return (
    <>
      {sekcije.map((sekcija) => (
        <JednaSekcija key={sekcija.id} sekcija={sekcija} jezik={jezik} />
      ))}
    </>
  );
}
