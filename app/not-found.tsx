import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { RenderSekcije } from "@/components/sekcije";

/**
 * Stranica 404.
 *
 * Stoji u korenu `app/`, izvan grupe `(shop)`, pa NEMA navigaciju ni podnožje —
 * to se ne menja: 404 se servira i sa adresa koje nisu deo prodavnice.
 *
 * Next za ovu stranicu i dalje šalje HTTP 404; sekcije ispod ne menjaju status
 * odgovora, samo sadržaj. Da menjaju, pretraživači bi praznu adresu tretirali
 * kao ispravnu stranicu.
 */
export default function NotFound() {
  return (
    <>
      <div className="flex min-h-[70vh] items-center justify-center bg-background">
        <div className="px-4 text-center">
          <h1 className="mb-4 font-display text-6xl text-primary lg:text-8xl">404</h1>
          <h2 className="mb-4 text-2xl font-medium text-text lg:text-3xl">
            Stranica nije pronađena
          </h2>
          <p className="mx-auto mb-8 max-w-md text-text-muted">
            Žao nam je, stranica koju tražite ne postoji ili je premeštena.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/">Početna stranica</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/contact">Kontaktirajte nas</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Ono što admin doda posetiocu koji je zalutao — na primer kategorije.
          Prazna zona ne renderuje nijedan element. */}
      <RenderSekcije pageKey="not-found" />
    </>
  );
}
