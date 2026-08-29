import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { fetchProductBySlug, fetchProductById } from "@/lib/products";
import { getProductPromotions } from "@/lib/promotions";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { BreadcrumbJsonLd } from "@/components/seo";
import { ProductReviews, RecentlyViewed } from "@/components/product";
import { getProductReviewStats } from "@/lib/models/reviews";
import { getLocalized } from "@/lib/i18n/localized";
import type { Metadata } from "next";
import LocalProductDetail from "./LocalProductDetail";
import { getStoreSettings } from "@/lib/config/store-settings";
import { storeCapabilities } from "@/lib/config/capabilities";

interface PageProps {
  params: Promise<{ id: string }>;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const [locale, settings] = await Promise.all([getLocale(), getStoreSettings()]);
  const storeName = settings["store.name"];
  const product =
    (await fetchProductBySlug(id)) || (await fetchProductById(id));

  if (!product) {
    return { title: "Proizvod nije pronađen" };
  }

  const name = getLocalized(product.name, locale);
  const desc = getLocalized(product.description, locale);
  const metaTitle = getLocalized(product.metaTitle, locale);
  const metaDesc = getLocalized(product.metaDescription, locale);
  const description =
    `Kupite ${name} online. ${product.material || ""} ${desc?.substring(0, 100) || ""}`.trim();

  return {
    title: metaTitle || name,
    description: metaDesc || description,
    openGraph: {
      title: name,
      description: metaDesc || description,
      type: "website",
      url: `${baseUrl}/product/${product.slug}`,
      siteName: storeName,
      images: product.image1
        ? [
            {
              url: `${baseUrl}${product.image1}`,
              width: 1200,
              height: 630,
              alt: name,
            },
          ]
        : [],
    },
  };
}

async function ProductContent({ id }: { id: string }) {
  const [locale, settings] = await Promise.all([getLocale(), getStoreSettings()]);
  const storeName = settings["store.name"];
  const product =
    (await fetchProductBySlug(id)) || (await fetchProductById(id));
  if (!product) notFound();

  const [reviewStats, promotions] = await Promise.all([
    storeCapabilities.reviews ? getProductReviewStats(product.id) : Promise.resolve(null),
    getProductPromotions(product.id),
  ]);

  const productName = getLocalized(product.name, locale);
  const categoryName = product.category ? getLocalized(product.category.name, locale) : "Proizvodi";
  const categoryHref = product.category?.slug
    ? `/catalog?category=${product.category.slug}`
    : "/catalog";

  // JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName,
    description: getLocalized(product.description, locale) || productName,
    image: product.image1 ? `${baseUrl}${product.image1}` : undefined,
    sku: product.sku || product.id,
    brand: product.brand
      ? { "@type": "Brand", name: getLocalized(product.brand.name, locale) }
      : undefined,
    color: product.color || undefined,
    material: product.material || undefined,
    weight: product.weight
      ? {
          "@type": "QuantitativeValue",
          value: Number(product.weight),
          unitCode: "GRM",
        }
      : undefined,
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/product/${product.slug}`,
      priceCurrency: "RSD",
      price: product.salePrice || product.price,
      availability: product.sizes.some((s) => s.stock > 0)
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: storeName },
    },
    ...(reviewStats &&
      reviewStats.count > 0 && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: reviewStats.average.toFixed(1),
          reviewCount: reviewStats.count.toString(),
          bestRating: "5",
          worstRating: "1",
        },
      }),
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Početna", href: "/" },
          { name: categoryName, href: categoryHref },
          { name: productName, href: `/product/${product.slug}` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <LocalProductDetail product={product} promotions={promotions} />

      {storeCapabilities.reviews && (
        <section className="mt-12 pt-8 border-t border-stone-200">
          <ProductReviews productCode={product.id} />
        </section>
      )}

      <RecentlyViewed excludeId={product.id} />
    </>
  );
}

export default async function ProductPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="container-wide py-8 lg:py-12">
      <Suspense
        fallback={
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <ProductCardSkeleton />
            <div className="space-y-4">
              <div className="h-8 bg-background-alt rounded animate-pulse" />
              <div className="h-6 w-1/2 bg-background-alt rounded animate-pulse" />
              <div className="h-12 w-1/3 bg-background-alt rounded animate-pulse" />
            </div>
          </div>
        }
      >
        <ProductContent id={id} />
      </Suspense>
    </div>
  );
}
