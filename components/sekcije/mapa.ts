import type { ComponentType, ReactElement } from "react";
import { SekcijaCenovnik } from "./SekcijaCenovnik";
import { SekcijaClanci } from "./SekcijaClanci";
import { SekcijaHero } from "./SekcijaHero";
import { SekcijaNaslov } from "./SekcijaNaslov";
import { SekcijaNewsletter } from "./SekcijaNewsletter";
import { SekcijaOdbrojavanje } from "./SekcijaOdbrojavanje";
import { SekcijaProizvodi } from "./SekcijaProizvodi";
import { SekcijaStavke } from "./SekcijaStavke";
import { SekcijaTabela } from "./SekcijaTabela";
import { SekcijaTaksonomija } from "./SekcijaTaksonomija";
import { SekcijaTekst } from "./SekcijaTekst";
import { SekcijaTraka } from "./SekcijaTraka";
import { SekcijaUtisci } from "./SekcijaUtisci";
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
  tekst: SekcijaTekst,
  tabela: SekcijaTabela,
  cenovnik: SekcijaCenovnik,
  traka: SekcijaTraka,
  odbrojavanje: SekcijaOdbrojavanje,
  newsletter: SekcijaNewsletter,
  taksonomija: SekcijaTaksonomija,
  proizvodi: SekcijaProizvodi,
  clanci: SekcijaClanci,
  utisci: SekcijaUtisci,
};
