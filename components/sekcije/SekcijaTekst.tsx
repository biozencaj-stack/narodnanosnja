import { sanitizujZaPrikaz } from "@/lib/sekcije/prikaz";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { KLASE_PRIGUSENOG, shemaZa, spoji } from "./stilovi";
import { citajOkvir, type Konfiguracija } from "./tipovi";

/**
 * Bogati tekst — WoodMart „HTML block“.
 *
 * Sadržaj prolazi kroz `sanitizujZaPrikaz`, drugu granicu sanitizacije. Prva je
 * pri upisu; ova postoji jer red može ući u bazu i mimo validatora — kroz seed,
 * ručni SQL ili restore starijeg dampa. Komponenta ne sme da zove sanitizer
 * direktno: funkcija stoji pod `lib/` da bi je `npm test` pokrenuo.
 */
export function SekcijaTekst({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const html = sanitizujZaPrikaz(config.sadrzaj, jezik);
  const shema = shemaZa(okvir.pozadina);

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />
      {html && (
      <div
        className={spoji(
          "max-w-2xl space-y-4 text-[1.02rem] leading-relaxed",
          "[&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold",
          "[&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_a]:text-primary [&_a]:underline",
          KLASE_PRIGUSENOG[shema],
        )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </OkvirSekcije>
  );
}
