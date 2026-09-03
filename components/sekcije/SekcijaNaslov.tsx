import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { citajOkvir, type Konfiguracija } from "./tipovi";

/**
 * Samostalno zaglavlje između dve sekcije — WoodMart „Title“.
 *
 * Ista sekcija sa praznim zaglavljem i uključenim razdelnikom daje čistu
 * tkanu traku preko stranice, koju je početna do sada imala kao zaseban
 * element van svake sekcije.
 */
export function SekcijaNaslov({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  return (
    <ZaglavljeSekcije okvir={citajOkvir(config)} jezik={jezik} varijanta="sekcijska" />
  );
}
