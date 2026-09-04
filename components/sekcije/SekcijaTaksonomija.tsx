import Image from "next/image";
import Link from "next/link";
import {
  ucitajKarticeBrendova,
  ucitajKarticeKategorija,
  type KarticaTaksonomije,
} from "@/lib/db/taksonomija";
import { getLocalized } from "@/lib/i18n/localized";
import { MestodrzacProizvoda } from "@/components/ukras";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { KLASE_NASLOVA, klaseMreze, shemaZa, spoji } from "./stilovi";
import { broj, citajOkvir, izbor, type Konfiguracija } from "./tipovi";

/**
 * Kartice kategorija i brendova — WoodMart „Product categories“ i „Brands“.
 *
 * Čita kategorije označene za navigaciju, odnosno brendove koji imaju bar jedan
 * aktivan proizvod, pa admin nema drugi spisak da održava. Slika je ona koju je
 * admin već uneo uz kategoriju ili brend; dok je nema, stoji tkana šara, jer je
 * prazna kutija gora od ukrasa.
 *
 * Greška upita obara samo ovu sekciju, ne stranicu; to je isto ponašanje koje
 * je zatečena početna već imala.
 */
export async function SekcijaTaksonomija({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const izvor = izbor(config, "izvor", ["kategorije", "brendovi"] as const, "kategorije");
  const kolone = izbor(config, "kolone", ["2", "3", "4"] as const, "3");
  const najvise = broj(config, "broj", 24);
  const saPodkategorijama = config.podkategorije === true;
  const shema = shemaZa(okvir.pozadina);

  let stavke: KarticaTaksonomije[] = [];
  try {
    stavke =
      izvor === "brendovi"
        ? await ucitajKarticeBrendova()
        : await ucitajKarticeKategorija();
  } catch {
    return null;
  }
  if (stavke.length === 0) return null;

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />

      <div className={klaseMreze("kartice", kolone)}>
        {stavke.slice(0, najvise).map((stavka, i) => {
          const naziv = getLocalized(stavka.naziv, jezik);
          const podstavke = saPodkategorijama ? stavka.podstavke : [];
          return (
            // Kartica je `div`, a ne `Link`: veze ka podkategorijama bi inače
            // bile ugnežđene u vezu, što HTML ne dozvoljava i što čitač ekrana
            // pročita kao jednu veliku vezu.
            <div
              key={stavka.id}
              className="group overflow-hidden rounded-2xl border border-border bg-povrsina shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-zlatna hover:shadow-md"
            >
              <Link href={stavka.veza} className="block">
                <div className="relative h-28 overflow-hidden lg:h-32">
                  {stavka.slika ? (
                    <Image
                      src={stavka.slika}
                      alt=""
                      fill
                      sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, 320px"
                      className={
                        izvor === "brendovi"
                          ? "object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                          : "object-cover transition-transform duration-300 group-hover:scale-105"
                      }
                    />
                  ) : (
                    <MestodrzacProizvoda redni={i} />
                  )}
                </div>
                <div className="flex items-center justify-between gap-3 px-5 pt-4">
                  <h3
                    className={spoji(
                      "font-display text-[1.08rem] font-bold leading-snug",
                      KLASE_NASLOVA[shema],
                    )}
                  >
                    {naziv}
                  </h3>
                  <span
                    aria-hidden="true"
                    className="text-lg text-primary transition-transform duration-200 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </div>
              </Link>

              {podstavke.length > 0 && (
                <ul
                  className="flex flex-wrap gap-x-3 gap-y-1 px-5 pb-4 pt-2"
                  aria-label={`Podkategorije: ${naziv}`}
                >
                  {podstavke.map((podstavka) => (
                    <li key={podstavka.id}>
                      <Link
                        href={podstavka.veza}
                        className="text-sm text-text-muted underline-offset-2 hover:text-text hover:underline"
                      >
                        {getLocalized(podstavka.naziv, jezik)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {podstavke.length === 0 && <div className="pb-4" />}
            </div>
          );
        })}
      </div>
    </OkvirSekcije>
  );
}
