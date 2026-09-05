import { citajLok } from "@/lib/sekcije/polja";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { Dugme } from "./Dugmad";
import { KLASE_NASLOVA, KLASE_PRIGUSENOG, klaseMreze, shemaZa, spoji } from "./stilovi";
import { citajOkvir, izbor, stavkeListe, veza, type Konfiguracija } from "./tipovi";

/**
 * Cenovnik — WoodMart „Pricing tables“ i „Menu price“.
 *
 * Osobine su višelinijski tekst, jedna po redu, a ne ugnežđena lista: admin
 * obrazac namerno ne ume da ugnezdi repeater u repeater, jer takav obrazac
 * postaje neupotrebljiv na ekranu.
 *
 * Cena je slobodan tekst, ne broj: paket ume da glasi „od 3.500“ ili „po
 * dogovoru“, a broj bi to naterao u laž. Cene proizvoda i dalje dolaze
 * isključivo sa servera — ovo je cenovnik usluga, ne katalog.
 */
export function SekcijaCenovnik({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const shema = shemaZa(okvir.pozadina);
  const kolone = izbor(config, "kolone", ["2", "3", "4"] as const, "3");
  const paketi = stavkeListe(config, "paketi");

  if (paketi.length === 0) return null;

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />

      <ul className={klaseMreze("kartice", kolone)}>
        {paketi.map((paket, i) => {
          const osobine = citajLok(paket.osobine, jezik)
            .split("\n")
            .map((red) => red.trim())
            .filter((red) => red.length > 0);
          const istaknut = paket.istaknuto === true;
          const cilj = veza(paket.veza);
          const natpis = citajLok(paket.natpisDugmeta, jezik);

          return (
            <li
              key={i}
              className={spoji(
                "flex flex-col rounded-2xl border bg-povrsina p-6 shadow-sm",
                istaknut ? "border-zlatna ring-1 ring-zlatna/40" : "border-border",
              )}
            >
              <h3
                className={spoji(
                  "font-display text-[1.15rem] font-bold",
                  KLASE_NASLOVA[shema],
                )}
              >
                {citajLok(paket.naziv, jezik)}
              </h3>

              {citajLok(paket.opis, jezik) && (
                <p className={spoji("mt-1 text-[0.88rem]", KLASE_PRIGUSENOG[shema])}>
                  {citajLok(paket.opis, jezik)}
                </p>
              )}

              {typeof paket.cena === "string" && paket.cena && (
                <p className="mt-4 flex items-baseline gap-1.5">
                  <span className="font-display text-[2rem] font-bold leading-none text-primary">
                    {paket.cena}
                  </span>
                  {typeof paket.valuta === "string" && paket.valuta && (
                    <span className={spoji("text-[0.95rem]", KLASE_PRIGUSENOG[shema])}>
                      {paket.valuta}
                    </span>
                  )}
                  {citajLok(paket.sufiks, jezik) && (
                    <span className={spoji("text-[0.85rem]", KLASE_PRIGUSENOG[shema])}>
                      {citajLok(paket.sufiks, jezik)}
                    </span>
                  )}
                </p>
              )}

              {osobine.length > 0 && (
                <ul className="mt-4 space-y-1.5">
                  {osobine.map((osobina, j) => (
                    <li
                      key={j}
                      className={spoji("flex gap-2 text-[0.9rem]", KLASE_PRIGUSENOG[shema])}
                    >
                      <span aria-hidden="true" className="text-zlatna">
                        ·
                      </span>
                      <span>{osobina}</span>
                    </li>
                  ))}
                </ul>
              )}

              {cilj && natpis && (
                <div className="mt-6 pt-1">
                  <Dugme
                    veza={cilj}
                    natpis={natpis}
                    stil={istaknut ? "puno" : "obrub"}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </OkvirSekcije>
  );
}
