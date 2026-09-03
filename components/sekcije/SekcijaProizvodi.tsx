import { fetchProducts, type ProductCardData } from "@/lib/products";
import { LocalProductCard } from "@/components/product/LocalProductCard";
import { ZaglavljeSekcije } from "./ZaglavljeSekcije";
import { klaseMreze } from "./stilovi";
import { citajOkvir, izbor, type Konfiguracija } from "./tipovi";

/**
 * Blok proizvoda — jedan parametrizovan tip umesto WoodMart-ovih „Recent“,
 * „Featured“, „Sale“ i „Products grid“ elemenata.
 *
 * Sekcija NIKAD ne pamti cenu. Konfiguracija čuva samo izvor i broj, a cena i
 * dostupnost se čitaju sa servera pri svakom prikazu — inače bi najvidljivija
 * stranica sajta prikazivala zastarelu cenu.
 */

const IZVORI = ["izdvojeno", "snizeno", "izdvojenoISnizeno"] as const;

async function ucitajProizvode(
  izvor: (typeof IZVORI)[number],
  koliko: number,
): Promise<ProductCardData[]> {
  if (izvor === "izdvojeno") {
    const { products } = await fetchProducts({ featured: true, limit: koliko });
    return products;
  }
  if (izvor === "snizeno") {
    const { products } = await fetchProducts({ onSale: true, limit: koliko });
    return products;
  }

  // Izdvojeni prvi, pa sniženi koji već nisu među njima — isti redosled koji je
  // zatečena početna imala.
  const [{ products: izdvojeni }, { products: snizeni }] = await Promise.all([
    fetchProducts({ featured: true, limit: koliko }),
    fetchProducts({ onSale: true, limit: koliko }),
  ]);

  const svi = [...izdvojeni];
  for (const proizvod of snizeni) {
    if (!svi.some((postojeci) => postojeci.id === proizvod.id)) svi.push(proizvod);
  }
  return svi;
}

export async function SekcijaProizvodi({
  config,
  jezik,
}: {
  config: Konfiguracija;
  jezik: string;
}) {
  const okvir = citajOkvir(config);
  const kolone = izbor(config, "kolone", ["2", "3", "4"] as const, "4");

  const upit = config.upit;
  const izvor =
    upit && typeof upit === "object" && !Array.isArray(upit) &&
    typeof (upit as Record<string, unknown>).izvor === "string" &&
    (IZVORI as readonly string[]).includes((upit as Record<string, unknown>).izvor as string)
      ? ((upit as Record<string, unknown>).izvor as (typeof IZVORI)[number])
      : "izdvojenoISnizeno";
  const koliko =
    upit && typeof upit === "object" && !Array.isArray(upit) &&
    typeof (upit as Record<string, unknown>).broj === "number"
      ? Math.min(Math.max(Math.trunc((upit as Record<string, unknown>).broj as number), 1), 24)
      : 8;

  let proizvodi: ProductCardData[] = [];
  try {
    proizvodi = await ucitajProizvode(izvor, koliko);
  } catch (greska) {
    console.error("Ne mogu da učitam proizvode za sekciju:", greska);
    return null;
  }

  if (proizvodi.length === 0) return null;

  return (
    <>
      <ZaglavljeSekcije okvir={okvir} jezik={jezik} varijanta="sekcijska" />

      <div className={klaseMreze("proizvodi", kolone)}>
        {proizvodi.slice(0, koliko).map((proizvod) => (
          <LocalProductCard key={proizvod.id} product={proizvod} />
        ))}
      </div>
    </>
  );
}
