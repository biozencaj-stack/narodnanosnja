import { Suspense } from 'react';
import { NavBarWrapper, Footer, CartDrawer } from '@/components/layout';
import { SearchModal } from '@/components/search/SearchModal';
import { QuickViewModal } from '@/components/product';
import { ChatWidget } from '@/components/chat/ChatWidget';
import { storeCapabilities } from '@/lib/config/capabilities';
import { CartPricingProvider } from '@/components/checkout';
import { getStoreCommerceSettings } from '@/lib/config/store-settings';

// NavBar loading skeleton
function NavBarSkeleton() {
  return (
    <>
      <div className="fixed z-40 w-full">
        <div className="h-16 bg-povrsina border-b border-border" />
      </div>
      <div className="h-16" aria-hidden="true" />
    </>
  );
}

export default async function ShopLayout({
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
      <main id="glavni-sadrzaj" tabIndex={-1} className="min-h-screen">
        {children}
      </main>
      <Footer />
      <CartDrawer />
      <SearchModal />
      <QuickViewModal />
      {storeCapabilities.chat && <ChatWidget />}
    </CartPricingProvider>
  );
}
