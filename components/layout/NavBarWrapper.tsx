import { getLocale } from 'next-intl/server';
import { fetchBrands } from '@/lib/products';
import { NavBar } from './NavBar';
import { Ticker } from './Ticker';
import { getCachedTickerMessages } from '@/lib/db/cache';
import { getNavCategories, getNavFlags } from '@/lib/db/nav-categories';
import { getLocalized } from '@/lib/i18n/localized';
import { getStoreSettings } from '@/lib/config/store-settings';

/**
 * Server component wrapper for NavBar
 * Fetches brands, nav categories, and ticker messages from local database
 */
export async function NavBarWrapper() {
  const locale = await getLocale();
  const [brands, tickerMessages, navCategories, navFlags, settings] = await Promise.all([
    fetchBrands().catch(() => []),
    getCachedTickerMessages().catch(() => []),
    getNavCategories().catch(() => []),
    getNavFlags().catch(() => ({ hasSale: false, hasNovo: false })),
    getStoreSettings(),
  ]);

  const groupsAvailable = brands.map((b) => ({
    id: b.id,
    name: getLocalized(b.name, locale),
    slug: b.slug,
  }));

  const localizedNavCategories = navCategories.map((cat) => ({
    id: cat.id,
    name: getLocalized(cat.name, locale),
    slug: cat.slug,
    children: cat.children.map((child) => ({
      id: child.id,
      name: getLocalized(child.name, locale),
      slug: child.slug,
    })),
  }));

  return (
    <>
      {tickerMessages.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <Ticker messages={tickerMessages} />
        </div>
      )}
      <NavBar
        groupsAvailable={groupsAvailable}
        navCategories={localizedNavCategories}
        hasSale={navFlags.hasSale}
        hasNovo={navFlags.hasNovo}
        hasTickerAbove={tickerMessages.length > 0}
        storeName={settings['store.name']}
        storeTagline={settings['store.tagline']}
      />
      <div
        className={tickerMessages.length > 0 ? 'h-[6.5rem]' : 'h-16'}
        aria-hidden="true"
      />
    </>
  );
}
