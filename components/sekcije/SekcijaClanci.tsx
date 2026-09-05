import Image from "next/image";
import Link from "next/link";
import { ucitajClanke, type KarticaClanka } from "@/lib/db/jeftini-tipovi";
import { MestodrzacProizvoda } from "@/components/ukras";
import { OkvirSekcije } from "./OkvirSekcije";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { KLASE_NASLOVA, KLASE_PRIGUSENOG, klaseMreze, shemaZa, spoji } from "./stilovi";
import { broj, citajOkvir, izbor, type Konfiguracija } from "./tipovi";

/**
 * Članci sa bloga — WoodMart „Blog element“.
 *
 * Boje su iz palete sekcija, ne `stone-*` iz zatečenih blog ekrana: sekcija se
 * postavlja na bilo koju od četiri pozadine, a fiksna siva bi na tamnoj
 * podlozi bila nečitljiva.
 *
 * POZNAT NEDOSTATAK: `Article.title` je obična `String` kolona, a ne
 * `Json { sr, en }` kao kod proizvoda i kategorija, pa naslov članka na
 * engleskoj verziji stranice stoji na srpskom. Ispravka traži migraciju kolone
 * i ne krije se ovde.
 */
export async function SekcijaClanci({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const shema = shemaZa(okvir.pozadina);
  const kolone = izbor(config, "kolone", ["2", "3", "4"] as const, "3");
  const koliko = Math.min(Math.max(Math.trunc(broj(config, "broj", 3)), 1), 12);
  const saSazetkom = config.sazetak !== false;

  let clanci: KarticaClanka[] = [];
  try {
    clanci = await ucitajClanke(koliko);
  } catch (greska) {
    console.error("Ne mogu da učitam članke za sekciju:", greska);
    return null;
  }
  if (clanci.length === 0) return null;

  return (
    <OkvirSekcije config={okvir}>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />

      <ul className={klaseMreze("kartice", kolone)}>
        {clanci.map((clanak, i) => (
          <li
            key={clanak.id}
            className="group overflow-hidden rounded-2xl border border-border bg-povrsina shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-zlatna hover:shadow-md"
          >
            <Link href={`/blog/${clanak.slug}`} className="block">
              <div className="relative h-40 overflow-hidden">
                {clanak.slika ? (
                  <Image
                    src={clanak.slika}
                    alt=""
                    fill
                    sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 360px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <MestodrzacProizvoda redni={i} />
                )}
              </div>
              <div className="p-5">
                {clanak.objavljen && (
                  <time
                    dateTime={clanak.objavljen}
                    className={spoji(
                      "block text-[0.78rem] uppercase tracking-wider",
                      KLASE_PRIGUSENOG[shema],
                    )}
                  >
                    {new Intl.DateTimeFormat(jezik === "en" ? "en-GB" : "sr-RS", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                      timeZone: "UTC",
                    }).format(new Date(clanak.objavljen))}
                  </time>
                )}
                <h3
                  className={spoji(
                    "mt-1.5 font-display text-[1.08rem] font-bold leading-snug",
                    KLASE_NASLOVA[shema],
                  )}
                >
                  {clanak.naslov}
                </h3>
                {saSazetkom && clanak.sazetak && (
                  <p
                    className={spoji(
                      "mt-2 line-clamp-3 text-[0.9rem] leading-relaxed",
                      KLASE_PRIGUSENOG[shema],
                    )}
                  >
                    {clanak.sazetak}
                  </p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </OkvirSekcije>
  );
}
