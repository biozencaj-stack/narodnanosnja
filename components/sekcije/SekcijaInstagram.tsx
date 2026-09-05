import Image from "next/image";
import Link from "next/link";
import { citajLok, jeObicanObjekat } from "@/lib/sekcije/polja";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { klaseMreze } from "./stilovi";
import { citajOkvir, izbor, stavkeListe, veza, type Konfiguracija } from "./tipovi";

/**
 * Instagram — WoodMart „Instagram“.
 *
 * Slike se unose RUČNO iz medijateke. Graph API put namerno nije ponuđen kao
 * izvor: postojeća ruta `app/api/instagram-feed` je `force-dynamic` sa
 * `cache: 'no-store'`, pa bi svaki pogodak početne otišao na Instagram — sa
 * tokenom koji ističe i kvotom koja se troši. Dok ta ruta ne dobije sopstveni
 * keš, ovaj tip je ne zove.
 *
 * Zatečena `InstagramFeed.tsx` je obrisana zajedno sa ovim tipom; nije imala
 * pozivaoca.
 */
export function SekcijaInstagram({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const kolone = izbor(config, "kolone", ["2", "3", "4"] as const, "4");
  const cilj = veza(config.veza);
  const korisnickoIme =
    typeof config.korisnickoIme === "string" ? config.korisnickoIme.trim() : "";

  const slike = stavkeListe(config, "slike").flatMap((stavka) => {
    if (!jeObicanObjekat(stavka) || typeof stavka.putanja !== "string") return [];
    return [{ putanja: stavka.putanja, alt: citajLok(stavka.alt, jezik) }];
  });
  if (slike.length === 0) return null;

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />

      <ul className={klaseMreze("kartice", kolone)}>
        {slike.map((slika, i) => (
          <li key={i} className="relative aspect-square overflow-hidden rounded-xl">
            <Image
              src={slika.putanja}
              alt={slika.alt}
              fill
              sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 260px"
              className="object-cover transition-transform duration-300 hover:scale-105"
            />
          </li>
        ))}
      </ul>

      {cilj && (
        <p className="mt-5 text-center">
          <Link
            href={cilj.url}
            {...(cilj.noviTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="text-[0.95rem] font-semibold text-primary underline-offset-2 hover:underline"
          >
            {korisnickoIme ? `@${korisnickoIme}` : "Prati nas"}
          </Link>
        </p>
      )}
    </OkvirSekcije>
  );
}
