import Link from "next/link";
import { getLocalized } from "@/lib/i18n/localized";
import { ucitajUtiske, type Utisak } from "@/lib/db/jeftini-tipovi";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { KLASE_NASLOVA, KLASE_PRIGUSENOG, klaseMreze, shemaZa, spoji } from "./stilovi";
import { broj, citajOkvir, izbor, type Konfiguracija } from "./tipovi";

/**
 * Utisci kupaca — WoodMart „Testimonials“.
 *
 * Sadržaj dolazi ISKLJUČIVO iz stvarnih recenzija. Zatečena `Testimonials.tsx`
 * je nosila četiri izmišljena kupca sa imenima i gradovima; takav sadržaj je
 * neistinit i obrisan je, a ne prenesen u sekciju.
 *
 * Potpis je ime i prvo slovo prezimena — pun identitet kupca nije za javnu
 * stranicu.
 */
function Zvezdice({ ocena }: { ocena: number }) {
  return (
    <span
      className="text-[0.95rem] tracking-[0.12em] text-zlatna"
      aria-label={`Ocena ${ocena} od 5`}
    >
      <span aria-hidden="true">
        {"★".repeat(Math.max(0, Math.min(5, ocena)))}
        {"☆".repeat(Math.max(0, 5 - Math.min(5, ocena)))}
      </span>
    </span>
  );
}

export async function SekcijaUtisci({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const shema = shemaZa(okvir.pozadina);
  const kolone = izbor(config, "kolone", ["2", "3", "4"] as const, "3");
  const koliko = Math.min(Math.max(Math.trunc(broj(config, "broj", 3)), 1), 12);
  const najmanjaOcena = Math.min(Math.max(Math.trunc(broj(config, "najmanjaOcena", 4)), 1), 5);
  const samoSaKomentarom = config.samoSaKomentarom !== false;

  let utisci: Utisak[] = [];
  try {
    utisci = await ucitajUtiske(koliko, najmanjaOcena, samoSaKomentarom);
  } catch (greska) {
    console.error("Ne mogu da učitam utiske za sekciju:", greska);
    return null;
  }
  // Prazna sekcija je ovde ispravno stanje: prodavnica bez recenzija nema šta
  // da pokaže, a izmišljanje utisaka nije opcija.
  if (utisci.length === 0) return null;

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />

      <ul className={klaseMreze("kartice", kolone)}>
        {utisci.map((utisak) => (
          <li
            key={utisak.id}
            className="flex flex-col rounded-2xl border border-border bg-povrsina p-5 shadow-sm"
          >
            <Zvezdice ocena={utisak.ocena} />

            {utisak.naslov && (
              <h3
                className={spoji(
                  "mt-2 font-display text-[1.02rem] font-bold",
                  KLASE_NASLOVA[shema],
                )}
              >
                {utisak.naslov}
              </h3>
            )}

            {utisak.komentar && (
              <blockquote
                className={spoji("mt-2 text-[0.92rem] leading-relaxed", KLASE_PRIGUSENOG[shema])}
              >
                {utisak.komentar}
              </blockquote>
            )}

            <div className={spoji("mt-4 pt-2 text-[0.84rem]", KLASE_PRIGUSENOG[shema])}>
              <span className="font-semibold">{utisak.potpis}</span>
              {utisak.verifikovan && <span className="ml-2">· kupovina potvrđena</span>}
              {utisak.proizvod && (
                <>
                  {" · "}
                  <Link
                    href={`/product/${utisak.proizvod.slug}`}
                    className="underline underline-offset-2 hover:text-primary"
                  >
                    {getLocalized(utisak.proizvod.naziv, jezik)}
                  </Link>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </OkvirSekcije>
  );
}
