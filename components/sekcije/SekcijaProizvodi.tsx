import { LocalProductCard } from "@/components/product/LocalProductCard";
import { ucitajBlokProizvoda, type KarticaProizvoda } from "@/lib/db/blok-proizvoda";
import { citajLok } from "@/lib/sekcije/polja";
import { normalizujUpit } from "@/lib/sekcije/upit-proizvoda";
import { KaruselProizvoda } from "./KaruselProizvoda";
import { OkvirSekcije } from "./OkvirSekcije";
import { TaboviProizvoda } from "./TaboviProizvoda";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { klaseMrezeProizvoda } from "./stilovi";
import { citajOkvir, izbor, stavkeListe, type Konfiguracija } from "./tipovi";

/**
 * Blok proizvoda — jedan parametrizovan tip umesto WoodMart-ovih „Recent”,
 * „Featured”, „Sale”, „New”, „Products grid”, „Products carousel“, „Products
 * tabs“ i „Products by category“ elemenata.
 *
 * Sekcija NIKAD ne pamti cenu. Konfiguracija čuva samo opis upita, a cena i
 * dostupnost se čitaju sa servera pri svakom prikazu — inače bi najvidljivija
 * stranica sajta prikazivala zastarelu cenu.
 *
 * Svi tabovi se učitavaju na serveru, pa prelazak između njih ne pravi novi
 * zahtev. Upiti idu kroz `ucitajBlokProizvoda`, koji ista dva upita u istom
 * zahtevu svede na jedan.
 */

interface Grupa {
  kljuc: string;
  naslov: string;
  proizvodi: KarticaProizvoda[];
}

function Prikaz({
  proizvodi,
  prikaz,
  kolone,
  koloneMobilno,
  oznake,
  naziv,
}: {
  proizvodi: KarticaProizvoda[];
  prikaz: "mreza" | "karusel";
  kolone: string;
  koloneMobilno: string;
  oznake: boolean;
  naziv: string;
}) {
  if (prikaz === "karusel") {
    return (
      <KaruselProizvoda
        proizvodi={proizvodi}
        kolone={kolone}
        koloneMobilno={koloneMobilno}
        prikaziOznake={oznake}
        naziv={naziv}
      />
    );
  }
  return (
    <div className={klaseMrezeProizvoda(kolone, koloneMobilno)}>
      {proizvodi.map((proizvod) => (
        <LocalProductCard
          key={proizvod.id}
          product={proizvod}
          prikaziOznake={oznake}
        />
      ))}
    </div>
  );
}

export async function SekcijaProizvodi({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const prikaz = izbor(config, "prikaz", ["mreza", "karusel"] as const, "mreza");
  const kolone = izbor(config, "kolone", ["2", "3", "4"] as const, "4");
  const koloneMobilno = izbor(config, "koloneMobilno", ["1", "2"] as const, "2");
  const oznake = config.oznake !== false;

  // Jedan tab nije tab. Tek od dva se prikazuje traka za izbor; ispod toga se
  // koristi glavni izvor, pa admin koji je počeo da pravi tabove pa odustao ne
  // dobije traku sa jednim dugmetom.
  const zapisiTabova = stavkeListe(config, "tabovi");
  const koristiTabove = zapisiTabova.length >= 2;

  const zahtevi: { kljuc: string; naslov: string; upit: ReturnType<typeof normalizujUpit> }[] =
    koristiTabove
      ? zapisiTabova.map((tab, indeks) => ({
          kljuc: `tab-${indeks}`,
          naslov: citajLok(tab.naslov, jezik),
          upit: normalizujUpit(tab.upit),
        }))
      : [{ kljuc: "glavni", naslov: "", upit: normalizujUpit(config.upit) }];

  let grupe: Grupa[];
  try {
    grupe = await Promise.all(
      zahtevi.map(async (zahtev) => ({
        kljuc: zahtev.kljuc,
        naslov: zahtev.naslov,
        proizvodi: await ucitajBlokProizvoda(zahtev.upit),
      })),
    );
  } catch (greska) {
    // Greška upita obara samo ovu sekciju, ne celu stranicu — isto ponašanje
    // koje je zatečena početna imala.
    console.error("Ne mogu da učitam proizvode za sekciju:", greska);
    return null;
  }

  const neprazne = grupe.filter((grupa) => grupa.proizvodi.length > 0);
  if (neprazne.length === 0) return null;

  const naslovSekcije = citajLok(okvir.naslov, jezik) || "blok proizvoda";

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />

      {koristiTabove && neprazne.length > 1 ? (
        <TaboviProizvoda
          tabovi={neprazne.map((grupa) => ({
            kljuc: grupa.kljuc,
            naslov: grupa.naslov || "Proizvodi",
            sadrzaj: (
              <Prikaz
                proizvodi={grupa.proizvodi}
                prikaz={prikaz}
                kolone={kolone}
                koloneMobilno={koloneMobilno}
                oznake={oznake}
                naziv={grupa.naslov || naslovSekcije}
              />
            ),
          }))}
        />
      ) : (
        <Prikaz
          proizvodi={neprazne[0].proizvodi}
          prikaz={prikaz}
          kolone={kolone}
          koloneMobilno={koloneMobilno}
          oznake={oznake}
          naziv={naslovSekcije}
        />
      )}
    </OkvirSekcije>
  );
}
