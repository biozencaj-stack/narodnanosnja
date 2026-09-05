import { citajLok, jeObicanObjekat } from "@/lib/sekcije/polja";
import { normalizujUpit } from "@/lib/sekcije/upit-proizvoda";
import { ucitajBlokProizvoda, type KarticaProizvoda } from "@/lib/db/blok-proizvoda";
import { OkvirSekcije } from "./OkvirSekcije";
import { TackeNaSlici } from "./TackeNaSlici";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { citajOkvir, stavkeListe, type Konfiguracija } from "./tipovi";

/**
 * Fotografija sa tačkama koje vode na proizvode — WoodMart „Image Hotspot“.
 *
 * Tačka nosi SAMO slug i položaj u procentima. Proizvodi se čitaju istim putem
 * kao blok proizvoda (`izvor: "izabrani"`), pa cena stiže sa servera pri prikazu
 * i deli keš sa svakim drugim blokom koji traži iste proizvode.
 *
 * Tačka čiji proizvod više ne postoji ili je ugašen jednostavno izostane —
 * bolje nego tačka koja vodi na 404.
 */
export async function SekcijaHotspot({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);

  const slika = jeObicanObjekat(config.slika) ? config.slika : null;
  const putanja = slika && typeof slika.putanja === "string" ? slika.putanja : null;
  if (!putanja) return null;

  const zapisi = stavkeListe(config, "tacke").flatMap((stavka) => {
    const x = typeof stavka.x === "number" ? stavka.x : null;
    const y = typeof stavka.y === "number" ? stavka.y : null;
    const slug = typeof stavka.proizvod === "string" ? stavka.proizvod : "";
    if (x === null || y === null || slug.length === 0) return [];
    return [{ x, y, slug }];
  });
  if (zapisi.length === 0) return null;

  let proizvodi: KarticaProizvoda[] = [];
  try {
    proizvodi = await ucitajBlokProizvoda(
      normalizujUpit({ izvor: "izabrani", izabrani: zapisi.map((z) => z.slug) }),
    );
  } catch (greska) {
    console.error("Ne mogu da učitam proizvode za tačke:", greska);
    return null;
  }

  const poSlugu = new Map(proizvodi.map((proizvod) => [proizvod.slug, proizvod]));
  const tacke = zapisi.flatMap((zapis) => {
    const proizvod = poSlugu.get(zapis.slug);
    return proizvod ? [{ x: zapis.x, y: zapis.y, proizvod }] : [];
  });
  if (tacke.length === 0) return null;

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />
      <TackeNaSlici
        slika={putanja}
        alt={citajLok(slika?.alt, jezik)}
        tacke={tacke}
        jezik={jezik}
      />
    </OkvirSekcije>
  );
}
