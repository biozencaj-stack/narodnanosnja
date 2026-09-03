import Link from "next/link";
import { getNavCategories } from "@/lib/db/nav-categories";
import { getLocalized } from "@/lib/i18n/localized";
import { MestodrzacProizvoda } from "@/components/ukras";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { KLASE_NASLOVA, klaseMreze, shemaZa, spoji } from "./stilovi";
import { broj, citajOkvir, izbor, type Konfiguracija } from "./tipovi";

/**
 * Kartice kategorija — WoodMart „Product categories“.
 *
 * Čita kategorije označene za navigaciju, pa admin nema drugi spisak da
 * održava. Greška u upitu obara samo ovu sekciju, ne stranicu; to je isto
 * ponašanje koje je zatečena početna već imala.
 */
export async function SekcijaTaksonomija({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const kolone = izbor(config, "kolone", ["2", "3", "4"] as const, "3");
  const najvise = broj(config, "broj", 24);
  const shema = shemaZa(okvir.pozadina);

  let kategorije: Awaited<ReturnType<typeof getNavCategories>> = [];
  try {
    kategorije = await getNavCategories();
  } catch {
    return null;
  }
  if (kategorije.length === 0) return null;

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />

      <div className={klaseMreze("kartice", kolone)}>
        {kategorije.slice(0, najvise).map((kategorija, i) => (
          <Link
            key={kategorija.id}
            href={`/category/${kategorija.slug}`}
            className="group overflow-hidden rounded-2xl border border-border bg-povrsina shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-zlatna hover:shadow-md"
          >
            <div className="h-28 overflow-hidden lg:h-32">
              <MestodrzacProizvoda redni={i} />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-4">
              <h3
                className={spoji(
                  "font-display text-[1.08rem] font-bold leading-snug",
                  KLASE_NASLOVA[shema],
                )}
              >
                {getLocalized(kategorija.name, jezik)}
              </h3>
              <span
                aria-hidden="true"
                className="text-lg text-primary transition-transform duration-200 group-hover:translate-x-1"
              >
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </OkvirSekcije>
  );
}
