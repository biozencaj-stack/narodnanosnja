import { Suspense } from "react";
import { NavBarWrapper, Footer, CartDrawer } from "@/components/layout";
import { SearchModal } from "@/components/search/SearchModal";
import { QuickViewModal } from "@/components/product";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { RenderSekcije } from "@/components/sekcije";
import { storeCapabilities } from "@/lib/config/capabilities";
import { CartPricingProvider } from "@/components/checkout";
import { getStoreCommerceSettings } from "@/lib/config/store-settings";

/**
 * Zajednički okvir prodavnice.
 *
 * `app/(shop)/layout.tsx` i `app/(legal)/layout.tsx` su do faze 7 imali
 * prepisan isti okvir sa dve stvarne razlike, pa se pri svakoj izmeni jedan od
 * njih zaboravljao. Razlike su sada IZRIČITE zastavice, a ne dve kopije:
 *
 * - pravne stranice nemaju `QuickViewModal` ni `ChatWidget`;
 * - pravne stranice se prelamaju u uzak `article` sa `prose` stilovima.
 *
 * Skup montiranih komponenti je namerno ostao isti kakav je bio na obe grupe.
 * Objedinjavanje koje uz put doda ili oduzme komponentu nije objedinjavanje.
 */
function KosturNavigacije() {
  return (
    <>
      <div className="fixed z-40 w-full">
        <div className="h-16 border-b border-border bg-povrsina" />
      </div>
      <div className="h-16" aria-hidden="true" />
    </>
  );
}

export async function OkvirProdavnice({
  children,
  varijanta,
}: {
  children: React.ReactNode;
  varijanta: "prodavnica" | "pravno";
}) {
  const commerceSettings = await getStoreCommerceSettings();
  const pravno = varijanta === "pravno";

  return (
    <CartPricingProvider commerceSettings={commerceSettings}>
      <Suspense fallback={<KosturNavigacije />}>
        <NavBarWrapper />
      </Suspense>

      <main
        id="glavni-sadrzaj"
        tabIndex={-1}
        className={pravno ? "min-h-screen bg-background-alt" : "min-h-screen"}
      >
        {pravno ? (
          <div className="container-narrow py-12 lg:py-20">
            <article className="prose prose-lg max-w-none rounded-2xl bg-background p-8 shadow-sm lg:p-12">
              {children}
            </article>
          </div>
        ) : (
          children
        )}

        {/* Zona iznad podnožja, na SVAKOJ stranici prodavnice. Zato registar
            u nju ne pušta tipove koji čitaju katalog — vidi `STRANICE`. */}
        <RenderSekcije pageKey="prefooter" />
      </main>

      <Footer />
      <CartDrawer />
      <SearchModal />
      {!pravno && <QuickViewModal />}
      {!pravno && storeCapabilities.chat && <ChatWidget />}
    </CartPricingProvider>
  );
}
