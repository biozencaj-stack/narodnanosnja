/**
 * Mapiranje reda `Promotion` u oblik koji ide u prikaz.
 *
 * Izdvojeno iz `lib/promotions.ts` iz dva razloga, ista dva kao kod
 * `products-filter.ts`. Prvi: taj fajl ima `"use server"` na prvoj liniji, pa
 * svaki njegov izvoz mora biti asinhrona funkcija i postaje javna Server
 * Action. Drugi: `npm test` glob-uje samo `lib/**\/*.test.ts`, pa se mapiranje
 * mora odvojiti od funkcije koja odmah zove bazu da bi se moglo proveriti.
 */

export interface RedPromocije {
  id: string;
  name: string;
  type: string;
  value: unknown;
  description: string | null;
  code: string | null;
  minQuantity: number | null;
  endDate: Date;
}

export interface PromocijaZaPrikaz {
  id: string;
  name: string;
  type: string;
  value: number;
  description: string | null;
  code: string | null;
  minQuantity: number | null;
  /**
   * Trenutak isteka, kao ISO string.
   *
   * Ranije se NIJE vraćao, pa odbrojavanje nije imalo do čega da broji. `Date`
   * ne prelazi granicu servera i klijenta u serijalizovanom obliku bez tihe
   * pretvorbe, pa se šalje kao ISO string.
   */
  endDate: string;
}

export function uPromocijuZaPrikaz(red: RedPromocije): PromocijaZaPrikaz {
  return {
    id: red.id,
    name: red.name,
    type: red.type,
    value: Number(red.value),
    description: red.description,
    code: red.code,
    minQuantity: red.minQuantity,
    endDate: red.endDate.toISOString(),
  };
}
