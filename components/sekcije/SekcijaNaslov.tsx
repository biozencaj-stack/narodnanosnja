import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { citajOkvir, type Konfiguracija } from "./tipovi";

/**
 * Samostalno zaglavlje između dve sekcije — WoodMart „Title“.
 *
 * Ista sekcija sa praznim zaglavljem i uključenim razdelnikom daje čistu tkanu
 * traku preko stranice, koju je početna do sada imala kao zaseban element van
 * svake sekcije. Zato se okvir renderuje i kad zaglavlja nema.
 */
export function SekcijaNaslov({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />
    </OkvirSekcije>
  );
}
