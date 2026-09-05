import Link from "next/link";
import { citajLok } from "@/lib/sekcije/polja";
import { spoji } from "./stilovi";
import { stavkeListe, veza, type Konfiguracija, type Veza } from "./tipovi";

/**
 * Dugmad sekcije. Do dva po sekciji — treće nikad nije pomoglo odluci kupca.
 *
 * Veza se renderuje samo ako je i dalje bezbedna. Vrednost je proverena pri
 * upisu, ali red može doći iz starijeg zapisa ili seed skripte, pa dugme bez
 * upotrebljive veze jednostavno ne postoji — nikad ne vodi u prazno.
 */

const STILOVI: Record<string, string> = {
  puno:
    "rounded-full bg-primary px-7 py-3.5 text-[0.95rem] font-bold text-white " +
    "transition-colors hover:bg-primary-hover",
  obrub:
    "rounded-full border border-primary px-7 py-3.5 text-[0.95rem] font-bold " +
    "text-primary transition-colors hover:bg-primary/8",
  obrubSvetli:
    "rounded-full border border-zlatna-jaka/50 px-7 py-3.5 text-[0.95rem] " +
    "font-bold text-zlatna-jaka transition-colors hover:bg-zlatna-jaka/12",
};

/**
 * Jedno dugme. Izdvojeno da bi ga i cenovnik koristio, umesto da prepisuje
 * mapu stilova — dve kopije bi se razišle pri prvoj izmeni palete.
 */
export function Dugme({
  veza: cilj,
  natpis,
  stil = "puno",
}: {
  veza: Veza;
  natpis: string;
  stil?: string;
}) {
  const spoljna = /^https?:/i.test(cilj.url);
  const zajednicko = {
    className: STILOVI[stil] ?? STILOVI.puno,
    ...(cilj.noviTab ? { target: "_blank", rel: "noopener noreferrer" } : {}),
  };

  // Sidro i spoljna adresa idu običnim `a`; interne putanje kroz `Link`, da se
  // zadrži prelazak bez ponovnog učitavanja stranice.
  return spoljna || cilj.url.startsWith("#") ? (
    <a href={cilj.url} {...zajednicko}>
      {natpis}
    </a>
  ) : (
    <Link href={cilj.url} {...zajednicko}>
      {natpis}
    </Link>
  );
}

export function Dugmad({
  config,
  jezik,
  className,
}: {
  config: Konfiguracija;
  jezik: string;
  className?: string;
}) {
  const stavke = stavkeListe(config, "dugmad");
  const dugmad = stavke
    .map((stavka, i) => {
      const cilj = veza(stavka.veza);
      const natpis = citajLok(stavka.natpis, jezik);
      if (!cilj || !natpis) return null;

      const stil = typeof stavka.stil === "string" ? stavka.stil : "puno";
      return <Dugme key={i} veza={cilj} natpis={natpis} stil={stil} />;
    })
    .filter(Boolean);

  if (dugmad.length === 0) return null;

  return <div className={spoji("flex flex-wrap gap-3", className)}>{dugmad}</div>;
}
