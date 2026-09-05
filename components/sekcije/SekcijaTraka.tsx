import { citajLok } from "@/lib/sekcije/polja";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { TrakaKlizi } from "./TrakaKlizi";
import { broj, citajOkvir, stavkeListe, type Konfiguracija } from "./tipovi";

/**
 * Pokretna traka — WoodMart „Marquee“.
 *
 * Koristi postojeći `@keyframes marquee` iz `app/globals.css`, isti koji vozi
 * `components/layout/Ticker.tsx`; druga animacija za istu stvar bi se pri prvoj
 * izmeni razišla sa prvom.
 */
export function SekcijaTraka({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const reci = stavkeListe(config, "stavke")
    .map((stavka) => citajLok(stavka.tekst, jezik))
    .filter((tekst) => tekst.trim().length > 0);

  if (reci.length === 0) return null;

  const trajanje = Math.min(Math.max(Math.trunc(broj(config, "brzina", 30)), 10), 120);

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />
      <TrakaKlizi reci={reci} trajanjeSekundi={trajanje} />
    </OkvirSekcije>
  );
}
