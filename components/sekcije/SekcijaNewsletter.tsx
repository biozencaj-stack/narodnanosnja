import { NewsletterSection } from "@/components/home";
import { storeCapabilities } from "@/lib/config/capabilities";
import { OkvirSekcije } from "./OkvirSekcije";
import { citajOkvir, type Konfiguracija } from "./tipovi";

/**
 * Prijava na novosti kao sekcija.
 *
 * Obrazac je zatečena `NewsletterSection`, netaknut: nosi honeypot, meru vremena
 * do slanja i potvrdu u modalu, i to se ne prepisuje zbog preseljenja u sekcije.
 *
 * Provera prekidača ostaje i ovde, iako je ruta ne dozvoljava da se sekcija
 * doda dok je ugašen: prekidač se može ugasiti POSLE dodavanja, a tada obrazac
 * mora nestati sa sajta, ne da šalje u rutu koje nema.
 *
 * Zaglavlje sekcije se namerno ne renderuje — obrazac nosi sopstveni naslov i
 * dva naslova jedan iznad drugog izgledaju kao greška.
 */
export function SekcijaNewsletter({ config }: { config: Konfiguracija }) {
  if (!storeCapabilities.newsletter) return null;

  const okvir = citajOkvir(config);

  return (
    <OkvirSekcije config={okvir}>
      <NewsletterSection />
    </OkvirSekcije>
  );
}
