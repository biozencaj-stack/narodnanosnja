import Image from "next/image";
import { citajLok, jeObicanObjekat } from "@/lib/sekcije/polja";
import { Dugmad } from "./Dugmad";
import { OkvirSekcije } from "./OkvirSekcije";
import { Parallax } from "./Parallax";
import { UporediSlike } from "./UporediSlike";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { klaseMreze } from "./stilovi";
import { broj, citajOkvir, izbor, stavkeListe, type Konfiguracija } from "./tipovi";

/**
 * Slike u sekciji — WoodMart „Banners“, „Images gallery“, „Compare images“ i
 * „Parallax Scrolling“ pod jednim tipom.
 *
 * Prikaz određuje koliko se slika koristi: `baner` i `parallax` uzimaju prvu,
 * `uporedi` prve dve, `galerija` sve. Sekcija bez ijedne slike ne renderuje
 * ništa — prazan pravougaonik sa razmakom je vidljiv procep na stranici.
 */

interface Slika {
  putanja: string;
  alt: string;
}

function slikeIz(config: Konfiguracija, jezik: string): Slika[] {
  return stavkeListe(config, "slike").flatMap((stavka) => {
    if (!jeObicanObjekat(stavka) || typeof stavka.putanja !== "string") return [];
    return [{ putanja: stavka.putanja, alt: citajLok(stavka.alt, jezik) }];
  });
}

export function SekcijaMedij({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const prikaz = izbor(
    config,
    "prikaz",
    ["baner", "galerija", "uporedi", "parallax"] as const,
    "baner",
  );
  const slike = slikeIz(config, jezik);
  if (slike.length === 0) return null;

  const visina = Math.min(Math.max(Math.trunc(broj(config, "visina", 360)), 160), 720);
  const kolone = izbor(config, "kolone", ["2", "3", "4"] as const, "3");
  const zaglavlje = <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />;

  if (prikaz === "uporedi") {
    // Validator traži dve slike za ovaj prikaz, ali red je mogao ući u bazu i
    // mimo njega — kroz seed ili ručni SQL.
    if (slike.length < 2) return null;
    return (
      <OkvirSekcije config={okvir}>
        {zaglavlje}
        <UporediSlike
          pre={slike[0].putanja}
          posle={slike[1].putanja}
          altPre={slike[0].alt}
          altPosle={slike[1].alt}
          natpisPre="Pre"
          natpisPosle="Posle"
        />
      </OkvirSekcije>
    );
  }

  if (prikaz === "parallax") {
    return (
      <OkvirSekcije config={okvir}>
        <Parallax slika={slike[0].putanja} alt={slike[0].alt} visina={visina}>
          <Dugmad config={config} jezik={jezik} className="justify-center" />
        </Parallax>
      </OkvirSekcije>
    );
  }

  if (prikaz === "galerija") {
    return (
      <OkvirSekcije config={okvir}>
        {zaglavlje}
        <ul className={klaseMreze("kartice", kolone)}>
          {slike.map((slika, i) => (
            <li
              key={i}
              className="relative aspect-square overflow-hidden rounded-2xl border border-border"
            >
              <Image
                src={slika.putanja}
                alt={slika.alt}
                fill
                sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 320px"
                className="object-cover"
              />
            </li>
          ))}
        </ul>
      </OkvirSekcije>
    );
  }

  return (
    <OkvirSekcije config={okvir}>
      {zaglavlje}
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={{ height: `${visina}px` }}
      >
        <Image
          src={slike[0].putanja}
          alt={slike[0].alt}
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <Dugmad config={config} jezik={jezik} className="justify-center" />
        </div>
      </div>
    </OkvirSekcije>
  );
}
