import Image from "next/image";
import { citajLok, jeObicanObjekat } from "@/lib/sekcije/polja";
import { MestodrzacProizvoda } from "@/components/ukras";
import { Dugmad } from "./Dugmad";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { citajOkvir, izbor, stavkeListe, type Konfiguracija } from "./tipovi";

/**
 * Uvodni blok — WoodMart „Promo banner“ i slajder sa jednim slajdom.
 *
 * Dva prikaza: „mozaik“ (tekst levo, tri slike desno) i „centrirano“ (poziv na
 * akciju preko cele širine). Dok fotografija nema, u mozaiku stoji tkana šara
 * u fiksnom redosledu motiva — prazna kutija bi bila nazadak u odnosu na ono
 * što stranica danas prikazuje.
 */

/** Redosled motiva zatečen na početnoj; menja se samo sa pravim slikama. */
const MOTIVI_MOZAIKA = [0, 3, 1];

const OKVIR_SLIKE =
  "relative overflow-hidden rounded-2xl border border-border shadow-sm";

function Slika({
  vrednost,
  redni,
  velicine,
}: {
  vrednost: unknown;
  redni: number;
  velicine: string;
}) {
  if (!jeObicanObjekat(vrednost) || typeof vrednost.putanja !== "string") {
    return <MestodrzacProizvoda redni={MOTIVI_MOZAIKA[redni] ?? redni} />;
  }

  const dekorativna = vrednost.dekorativna === true;
  return (
    <Image
      src={vrednost.putanja}
      alt={dekorativna ? "" : citajLok(vrednost.alt, "sr")}
      fill
      sizes={velicine}
      className="object-cover"
    />
  );
}

export function SekcijaHero({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const prikaz = izbor(config, "prikaz", ["mozaik", "centrirano"] as const, "mozaik");
  const slike = stavkeListe(config, "slike");

  if (prikaz === "centrirano") {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="istaknuta" />
        <Dugmad config={config} jezik={jezik} className="mt-8 justify-center" />
      </div>
    );
  }

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
      <div>
        <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="uvodna" />
        <Dugmad config={config} jezik={jezik} className="mt-9" />
      </div>

      <div className="relative">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className={`aspect-[3/4] ${OKVIR_SLIKE}`}>
            <Slika vrednost={slike[0]} redni={0} velicine="(min-width: 1024px) 24vw, 45vw" />
          </div>
          <div className="mt-8 grid gap-3 sm:gap-4">
            <div className={`aspect-square ${OKVIR_SLIKE}`}>
              <Slika
                vrednost={slike[1]}
                redni={1}
                velicine="(min-width: 1024px) 24vw, 45vw"
              />
            </div>
            <div className={`aspect-square ${OKVIR_SLIKE}`}>
              <Slika
                vrednost={slike[2]}
                redni={2}
                velicine="(min-width: 1024px) 24vw, 45vw"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
