import { Suspense } from "react";
import {
  HeroRadionica,
  TrakaVrednosti,
  KategorijeTkanja,
  KakoNastaje,
  PricaOKrajevima,
} from "@/components/home/nosnja";
import { NewsletterSection } from "@/components/home";
import { ProductGridSkeleton } from "@/components/ui/Skeleton";
import { fetchProducts } from "@/lib/products";
import { LocalProductCard } from "@/components/product/LocalProductCard";
import { Traka } from "@/components/ukras";
import { storeCapabilities } from "@/lib/config/capabilities";

export const dynamic = "force-dynamic";

async function IstaknutiProizvodi() {
  try {
    const { products: naSnizenju } = await fetchProducts({ onSale: true, limit: 8 });
    const { products: izdvojeni } = await fetchProducts({ featured: true, limit: 8 });

    const svi = [...izdvojeni];
    for (const p of naSnizenju) {
      if (!svi.find((x) => x.id === p.id)) svi.push(p);
    }
    if (svi.length === 0) return null;

    return (
      <section className="bg-background py-14 lg:py-20">
        <div className="container-wide">
          <div className="mb-10 max-w-xl">
            <h2 className="font-display text-3xl font-bold text-text lg:text-4xl">
              Izdvojeno iz radionice
            </h2>
            <p className="mt-3 text-text-muted">
              Komadi koje najčešće preporučujemo — i za sebe i za poklon.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {svi.slice(0, 8).map((product) => (
              <LocalProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    );
  } catch (error) {
    console.error("Ne mogu da učitam istaknute proizvode:", error);
    return null;
  }
}

export default function HomePage() {
  return (
    <>
      <HeroRadionica />
      <TrakaVrednosti />

      <Suspense fallback={null}>
        <KategorijeTkanja />
      </Suspense>

      <Suspense
        fallback={
          <section className="bg-background py-14 lg:py-20">
            <div className="container-wide">
              <ProductGridSkeleton count={4} />
            </div>
          </section>
        }
      >
        <IstaknutiProizvodi />
      </Suspense>

      <Traka boja="var(--color-zlatna)" bojaDruga="var(--color-primary)" visina={20} />

      <KakoNastaje />
      <PricaOKrajevima />
      {storeCapabilities.newsletter && <NewsletterSection />}
    </>
  );
}
