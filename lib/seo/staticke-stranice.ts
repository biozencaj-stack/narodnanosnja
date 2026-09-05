import type { storeCapabilities } from "@/lib/config/capabilities";

/**
 * Statičke stranice koje idu u `sitemap.xml`.
 *
 * Spisak stoji ovde, a ne u `app/sitemap.ts`, da bi ga test mogao uporediti sa
 * stvarnim rutama pod `app/`. Ranije je bio tvrdo upisan u sitemapu i **već je
 * odstupao od ruta**: `/karijera` nije bio u njemu, a kategorije su izlazile
 * kao adrese kataloga sa parametrom koji katalog ne čita.
 *
 * `capability` znači da stranica postoji samo dok je funkcija upaljena — ista
 * provera koja u samoj stranici zove `notFound()`. Bez toga bi mapa sajta
 * prijavljivala adrese koje vraćaju 404.
 *
 * Namerno IZOSTAVLJENE: `/cart`, `/checkout`, `/payment/*` i `/pretraga` —
 * korpa i plaćanje su privatni tokovi (robots ih i zabranjuje), a pretraga je
 * beskonačan prostor adresa bez sopstvenog sadržaja.
 */
export interface StatickaStranica {
  /** Putanja od korena, bez završne kose crte. Prazan string je početna. */
  putanja: string;
  capability?: keyof typeof storeCapabilities;
}

export const STATICKE_STRANICE: StatickaStranica[] = [
  { putanja: "" },
  { putanja: "/catalog" },
  { putanja: "/blog" },
  { putanja: "/contact" },
  { putanja: "/o-nama" },
  { putanja: "/uputstvo" },
  { putanja: "/uslovi-koriscenja" },
  { putanja: "/politika-privatnosti" },
  { putanja: "/nacin-placanja" },
  { putanja: "/uslovi-isporuke" },
  { putanja: "/pravo-na-odustanak" },
  { putanja: "/povracaj-sredstava" },
  { putanja: "/reklamacije" },
  { putanja: "/zamena-proizvoda" },
  { putanja: "/prodajna-mesta", capability: "storeLocations" },
  { putanja: "/placanje-karticama", capability: "cardPayments" },
  { putanja: "/karijera", capability: "careers" },
];
