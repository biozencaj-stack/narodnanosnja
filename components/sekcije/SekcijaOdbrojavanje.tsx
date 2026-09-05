import { ucitajNajbliziIstekAkcije } from "@/lib/db/jeftini-tipovi";
import { Dugmad } from "./Dugmad";
import { Odbrojac } from "./Odbrojac";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { citajOkvir, izbor, type Konfiguracija } from "./tipovi";

/**
 * Odbrojavanje — WoodMart „Countdown timer“.
 *
 * Izvor `akcija` uzima aktivnu promociju koja prva ističe, iz `Promotion.endDate`.
 * Konkretna promocija se ne bira zato što javna ruta koja bi ih izlistala ne
 * postoji, a nova admin ruta samo zbog padajuće liste otvara površinu koju bi
 * trebalo i čuvati.
 *
 * Kad nema aktivne akcije, sekcija se ne prikazuje. Odbrojavanje do ničega je
 * gore od odsutne sekcije: posetilac vidi hitnost koja ne postoji.
 *
 * Zatečena `CountdownSale.tsx` je odbrojavala do trenutka izračunatog u
 * pregledaču, bez ijedne akcije u bazi — izmišljena hitnost. Obrisana je.
 */
export async function SekcijaOdbrojavanje({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const izvor = izbor(config, "izvor", ["akcija", "datum"] as const, "akcija");

  let istice: string | null = null;
  if (izvor === "datum") {
    const uneto = typeof config.datum === "string" ? config.datum : "";
    const trenutak = uneto ? new Date(uneto) : null;
    istice = trenutak && !Number.isNaN(trenutak.getTime()) ? trenutak.toISOString() : null;
  } else {
    try {
      const akcija = await ucitajNajbliziIstekAkcije();
      istice = akcija ? akcija.istice : null;
    } catch (greska) {
      console.error("Ne mogu da učitam akciju za odbrojavanje:", greska);
      return null;
    }
  }

  if (!istice) return null;

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />
      <Odbrojac istice={istice} porukaPoIsteku="Akcija je istekla." />
      <Dugmad config={config} jezik={jezik} className="mt-6 justify-center" />
    </OkvirSekcije>
  );
}
