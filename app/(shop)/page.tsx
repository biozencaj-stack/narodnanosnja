import { RenderSekcije } from "@/components/sekcije";

/**
 * Početna strana.
 *
 * Od faze 1 raspored je PODATAK, ne JSX: sekcije, njihov redosled i sav tekst
 * dolaze kroz registar tipova i renderer. Dok tabela `PageSection` ne postoji,
 * raspored stoji u `lib/sekcije/podrazumevani-raspored.ts` — vidi
 * `docs/PLAN-SEKCIJE.md`.
 *
 * `force-dynamic` se NE dira: blokovi proizvoda čitaju cenu sa servera pri
 * svakom zahtevu, a keširanje cene zajedno sa konfiguracijom bi na
 * najvidljivijoj stranici prikazalo zastarelu vrednost.
 *
 * Od faze 5 ovde nema nijedne sekcije ispisane rukom. Prijava na novosti je
 * bila poslednja i sada je tip `newsletter`, pa se može pomeriti i ugasiti iz
 * admin panela kao i sve ostalo.
 */

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <RenderSekcije pageKey="home" />;
}
