import { NewsletterSection } from "@/components/home";
import { RenderSekcije } from "@/components/sekcije";
import { storeCapabilities } from "@/lib/config/capabilities";

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
 * Prijava na novosti još nije tip sekcije (plan je vodi kao fazu 5), pa ostaje
 * ovde, iza svog capability prekidača.
 */

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <RenderSekcije pageKey="home" />
      {storeCapabilities.newsletter && <NewsletterSection />}
    </>
  );
}
