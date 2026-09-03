import type { ComponentType, ReactElement } from "react";
import { SekcijaHero } from "./SekcijaHero";
import { SekcijaNaslov } from "./SekcijaNaslov";
import { SekcijaProizvodi } from "./SekcijaProizvodi";
import { SekcijaStavke } from "./SekcijaStavke";
import { SekcijaTaksonomija } from "./SekcijaTaksonomija";
import { SekcijaTekst } from "./SekcijaTekst";
import type { Konfiguracija } from "./tipovi";

/**
 * Mapa `kind -> komponenta`.
 *
 * Namerno odvojena od `lib/sekcije/registar.ts`: registar opisuje polja i njega
 * uvozi i admin obrazac u pregledaču. Kad bi mapa komponenti stajala u njemu,
 * admin paket bi povukao ceo storefront.
 */

export interface PropsSekcije {
  config: Konfiguracija;
  jezik: string;
}

type KomponentaSekcije =
  | ComponentType<PropsSekcije>
  | ((props: PropsSekcije) => Promise<ReactElement | null>);

export const KOMPONENTE_SEKCIJA: Record<string, KomponentaSekcije> = {
  naslov: SekcijaNaslov,
  hero: SekcijaHero,
  stavke: SekcijaStavke,
  taksonomija: SekcijaTaksonomija,
  tekst: SekcijaTekst,
  proizvodi: SekcijaProizvodi,
};
