import { Suspense } from 'react';
import { NavBarWrapper, Footer, CartDrawer } from '@/components/layout';
import { SearchModal } from '@/components/search/SearchModal';
import { CartPricingProvider } from '@/components/checkout';
import { getStoreCommerceSettings } from '@/lib/config/store-settings';

function NavBarSkeleton() {
  return (
    <>
      <div className="fixed z-40 h-16 w-full border-b border-border bg-povrsina" />
      <div className="h-16" aria-hidden="true" />
    </>
  );
}

export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const commerceSettings = await getStoreCommerceSettings();

  return (
    <CartPricingProvider commerceSettings={commerceSettings}>
      <Suspense fallback={<NavBarSkeleton />}>
        <NavBarWrapper />
      </Suspense>
      <main id="glavni-sadrzaj" tabIndex={-1} className="min-h-screen bg-background-alt">
        <div className="container-narrow py-12 lg:py-20">
          <article className="prose prose-lg max-w-none bg-background rounded-2xl shadow-sm p-8 lg:p-12">
            {children}
          </article>
        </div>
      </main>
      <Footer />
      <CartDrawer />
      <SearchModal />
    </CartPricingProvider>
  );
}
