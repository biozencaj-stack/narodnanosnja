'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Heart } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { formatPriceWithCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils';
import { useWishlistStore } from '@/store';
import { getLocalized } from '@/lib/i18n/localized';
import { MestodrzacProizvoda } from '@/components/ukras';
import { storeCapabilities } from '@/lib/config/capabilities';

/**
 * Iz identifikatora pravi stabilan broj, da isti proizvod uvek dobije istu
 * šaru — inače bi se motiv menjao pri svakom prikazu.
 */
function sifraUBroj(vrednost: string): number {
  let zbir = 0;
  for (let i = 0; i < vrednost.length; i++) zbir = (zbir * 31 + vrednost.charCodeAt(i)) % 997;
  return zbir;
}

/**
 * Product card props for LOCAL CMS products
 * Uses slug-based URLs and /uploads/ image paths
 */
interface LocalProductCardProps {
  product: {
    id: string;
    slug: string;
    name: unknown; // Json: { sr, en }
    price: number;
    salePrice: number | null;
    image1: string | null;
    /** Druga fotografija — pojavljuje se pri prelasku mišem preko kartice. */
    image2?: string | null;
    onSale: boolean;
    novo?: boolean;
    category?: { name: unknown } | null;
    brand?: { name: unknown } | null;
  };
  className?: string;
  /**
   * Oznake „Novo” i procenat popusta. Podrazumevano stoje — isključuju se samo
   * tamo gde admin sekcije to izričito traži, na primer kad dva bloka stoje
   * jedan uz drugi pa se iste oznake ponavljaju.
   */
  prikaziOznake?: boolean;
  /**
   * Dugme „sačuvaj u želje“. Podrazumevano stoji; sekcija ga isključuje kad
   * blok služi kao izlog, a ne kao mesto sa kog se kupuje.
   */
  prikaziZelje?: boolean;
}

export function LocalProductCard({
  product,
  className,
  prikaziOznake = true,
  prikaziZelje = true,
}: LocalProductCardProps) {
  const { id, slug, name, price, salePrice, image1, image2, novo, category, brand } = product;
  const locale = useLocale();
  const displayName = getLocalized(name, locale);
  const categoryName = category ? getLocalized(category.name, locale) : '';
  const brandName = brand ? getLocalized(brand.name, locale) : '';
  const { data: session } = useSession();
  const { items, toggleItem, initialize, isInitialized } = useWishlistStore();

  const isInWishlist = items.includes(id);

  useEffect(() => {
    if (storeCapabilities.wishlist && session?.user && !isInitialized) {
      initialize();
    }
  }, [session, isInitialized, initialize]);

  const hasDiscount = salePrice !== null && salePrice < price;
  const finalPrice = salePrice || price;
  const discountPercent = hasDiscount
    ? Math.round(((price - salePrice!) / price) * 100)
    : 0;

  const handleWishlistClick = async () => {
    if (!session?.user) {
      window.location.href = '/login?callbackUrl=' + encodeURIComponent(window.location.pathname);
      return;
    }
    await toggleItem(id);
  };

  return (
    <article className={cn('group relative', className)}>
      {/* Image container */}
      <div className="relative aspect-square overflow-hidden rounded-md bg-white shadow-md hover:shadow-lg hover:shadow-gray-400/50 transition-all duration-300 ease-in-out">
        <Link
          href={`/product/${slug}`}
          className="block h-full w-full"
          aria-label={displayName}
        >

          {/* Oznake — u paleti radionice, ne u podrazumevanoj plavoj i crvenoj */}
          <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1.5">
            {prikaziOznake && novo && (
              <span className="rounded-full bg-zlatna px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-white">
                Novo
              </span>
            )}
            {prikaziOznake && hasDiscount && discountPercent > 0 && (
              <span className="rounded-full bg-primary px-2.5 py-1 text-[0.78rem] font-bold text-white">
                −{discountPercent}%
              </span>
            )}
          </div>

          {/* Product image */}
          {image1 ? (
            <>
              <Image
                src={image1}
                alt={displayName}
                fill
                sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 280px"
                quality={75}
                loading="lazy"
                className={cn(
                  'bg-povrsina object-contain p-4 transition-all duration-500',
                  image2 ? 'group-hover:opacity-0' : 'group-hover:scale-105',
                )}
              />
              {/* Druga fotografija se otkriva pri prelasku mišem — komad se
                  vidi i sa druge strane bez otvaranja stranice proizvoda. */}
              {image2 && (
                <Image
                  src={image2}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 280px"
                  quality={75}
                  loading="lazy"
                  className="bg-povrsina object-contain p-4 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                />
              )}
            </>
          ) : (
            // Dok fotografija ne postoji, stoji tkana šara umesto prazne sive
            // kutije — mreža proizvoda tako ne izgleda nedovršeno.
            <MestodrzacProizvoda redni={sifraUBroj(id)} />
          )}
        </Link>

        {storeCapabilities.wishlist && prikaziZelje && (
          <button
            type="button"
            className={cn(
              "absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-sm transition-all focus-visible:opacity-100",
              isInWishlist
                ? "bg-red-50 text-red-500 opacity-100"
                : "bg-white/80 text-gray-400 hover:text-red-500 hover:bg-white md:opacity-0 md:group-hover:opacity-100"
            )}
            onClick={handleWishlistClick}
            aria-label={isInWishlist ? "Ukloni iz favorita" : "Dodaj u favorite"}
            aria-pressed={isInWishlist}
          >
            <Heart className="h-5 w-5" fill={isInWishlist ? "currentColor" : "none"} />
          </button>
        )}
      </div>

      {/* Product info */}
      <div className="mt-4 space-y-1.5">
          {/* Brand / Category */}
          {(brand || category) && (
            <p className="text-xs text-gray-500">
              {brandName}{brand && category ? ' / ' : ''}{categoryName}
            </p>
          )}

          <h3 className="text-base text-gray-800 font-medium line-clamp-2 leading-snug" title={displayName}>
            <Link href={`/product/${slug}`} className="hover:text-primary transition-colors">
              {displayName}
            </Link>
          </h3>

          {/* Prices */}
          {hasDiscount ? (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-base line-through text-gray-400">
                {formatPriceWithCurrency(price)}
              </span>
              <span className="text-xl font-bold text-red-600">
                {formatPriceWithCurrency(finalPrice)}
              </span>
            </div>
          ) : (
            <div className="text-xl font-semibold text-gray-900 pt-1">
              {formatPriceWithCurrency(finalPrice)}
            </div>
          )}
      </div>
    </article>
  );
}
