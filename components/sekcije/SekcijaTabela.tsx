import { citajLok } from "@/lib/sekcije/polja";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { KLASE_NASLOVA, KLASE_PRIGUSENOG, shemaZa, spoji } from "./stilovi";
import { citajOkvir, stavkeListe, type Konfiguracija } from "./tipovi";

/**
 * Tabela — WoodMart „Table“.
 *
 * Podatak je strukturiran, a ne HTML: bela lista iz `lib/security/html.ts`
 * namerno ne dozvoljava `<table>`, pa bi tabela upisana kao bogat tekst tiho
 * nestala pri snimanju.
 *
 * Broj kolona određuje zaglavlje. Ćelije preko tog broja se ne renderuju —
 * red sa više ćelija nego što tabela ima kolona nije tabela nego kvar.
 *
 * Tabela je uvek u sopstvenom vodoravnom skrolu: na telefonu pet kolona ne
 * stane, a širenje stranice u stranu kvari ceo raspored.
 */

const KLJUCEVI_CELIJA = ["c1", "c2", "c3", "c4", "c5"] as const;

export function SekcijaTabela({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const shema = shemaZa(okvir.pozadina);
  const zaglavlje = stavkeListe(config, "zaglavlje");
  const redovi = stavkeListe(config, "redovi");
  const prvaJeZaglavlje = config.prvaKolonaZaglavlje !== false;

  if (zaglavlje.length === 0 || redovi.length === 0) return null;

  const kljucevi = KLJUCEVI_CELIJA.slice(0, zaglavlje.length);

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-left text-[0.94rem]">
          <thead>
            <tr className="border-b-2 border-zlatna/40">
              {zaglavlje.map((kolona, i) => (
                <th
                  key={i}
                  scope="col"
                  className={spoji(
                    "px-3 py-2.5 font-display text-[0.95rem] font-bold",
                    KLASE_NASLOVA[shema],
                  )}
                >
                  {citajLok(kolona.naslov, jezik)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {redovi.map((red, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {kljucevi.map((kljuc, j) => {
                  const sadrzaj = citajLok(red[kljuc], jezik);
                  // Prva kolona kao `th scope="row"`: čitač ekrana tada svaku
                  // ćeliju pročita zajedno sa nazivom reda, a ne kao goli broj.
                  if (j === 0 && prvaJeZaglavlje) {
                    return (
                      <th
                        key={kljuc}
                        scope="row"
                        className={spoji(
                          "px-3 py-2.5 font-semibold",
                          KLASE_NASLOVA[shema],
                        )}
                      >
                        {sadrzaj}
                      </th>
                    );
                  }
                  return (
                    <td key={kljuc} className={spoji("px-3 py-2.5", KLASE_PRIGUSENOG[shema])}>
                      {sadrzaj}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OkvirSekcije>
  );
}
