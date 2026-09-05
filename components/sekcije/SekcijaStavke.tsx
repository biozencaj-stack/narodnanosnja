import { citajLok } from "@/lib/sekcije/polja";
import { MestodrzacProizvoda } from "@/components/ukras";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import {
  KLASE_NASLOVA,
  KLASE_PRIGUSENOG,
  klaseMreze,
  shemaZa,
  spoji,
} from "./stilovi";
import { citajOkvir, izbor, stavkeListe, type Konfiguracija } from "./tipovi";

/**
 * Ponavljajuće stavke — jedan repeater umesto pet zasebnih WoodMart elemenata.
 *
 * `traka` je pojas vrednosti ispod uvodnog bloka, `koraci` su numerisani opis
 * postupka, `kartice` su opšti infobox. Sve tri dele istu šemu stavke; tabela i
 * cenovnik namerno NISU ovde nego su zasebni tipovi, jer stavka repeatera ne
 * može da nosi ni redove sa zaglavljem ni cenu sa listom osobina.
 */

const PRIKAZI = ["traka", "kartice", "koraci"] as const;

export function SekcijaStavke({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const prikaz = izbor(config, "prikaz", PRIKAZI, "kartice");
  const kolone = izbor(config, "kolone", ["2", "3", "4"] as const, "4");
  const stavke = stavkeListe(config, "stavke");
  const shema = shemaZa(okvir.pozadina);

  if (stavke.length === 0) return null;

  const zaglavlje = <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />;

  if (prikaz === "traka") {
    return (
      <OkvirSekcije config={okvir}>
        {zaglavlje}
        <ul className={klaseMreze("traka", kolone)}>
          {stavke.map((stavka, i) => (
            <li key={i} className="flex items-start gap-3.5">
              <span className="mt-0.5 h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-border">
                <MestodrzacProizvoda
                  redni={typeof stavka.motiv === "number" ? stavka.motiv : i}
                />
              </span>
              <span>
                <span
                  className={spoji(
                    "block font-display text-[1.02rem] font-bold",
                    KLASE_NASLOVA[shema],
                  )}
                >
                  {citajLok(stavka.naslov, jezik)}
                </span>
                <span
                  className={spoji(
                    "mt-0.5 block text-[0.86rem] leading-snug",
                    KLASE_PRIGUSENOG[shema],
                  )}
                >
                  {citajLok(stavka.tekst, jezik)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </OkvirSekcije>
    );
  }

  if (prikaz === "koraci") {
    return (
      <OkvirSekcije config={okvir}>
        {zaglavlje}
        <ol className={klaseMreze("koraci", kolone)}>
          {stavke.map((stavka, i) => (
            <li key={i}>
              {typeof stavka.oznaka === "string" && stavka.oznaka && (
                <span className="font-display text-[2.1rem] font-bold leading-none text-zlatna/45">
                  {stavka.oznaka}
                </span>
              )}
              <h3
                className={spoji(
                  "mt-3 font-display text-[1.15rem] font-bold",
                  KLASE_NASLOVA[shema],
                )}
              >
                {citajLok(stavka.naslov, jezik)}
              </h3>
              <p
                className={spoji(
                  "mt-2 text-[0.92rem] leading-relaxed",
                  KLASE_PRIGUSENOG[shema],
                )}
              >
                {citajLok(stavka.tekst, jezik)}
              </p>
            </li>
          ))}
        </ol>
      </OkvirSekcije>
    );
  }

  return (
    <OkvirSekcije config={okvir}>
      {zaglavlje}
      <ul className={klaseMreze("kartice", kolone)}>
        {stavke.map((stavka, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-2xl border border-border bg-povrsina p-5 shadow-sm"
          >
            <span className="mb-4 block h-12 w-12 overflow-hidden rounded-lg border border-border">
              <MestodrzacProizvoda
                redni={typeof stavka.motiv === "number" ? stavka.motiv : i}
              />
            </span>
            <h3
              className={spoji(
                "font-display text-[1.08rem] font-bold leading-snug",
                KLASE_NASLOVA[shema],
              )}
            >
              {citajLok(stavka.naslov, jezik)}
            </h3>
            <p className={spoji("mt-2 text-[0.9rem] leading-relaxed", KLASE_PRIGUSENOG[shema])}>
              {citajLok(stavka.tekst, jezik)}
            </p>
          </li>
        ))}
      </ul>
    </OkvirSekcije>
  );
}
