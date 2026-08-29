"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { getLocalized } from "@/lib/i18n/localized";
import {
  ShoppingBag,
  Check,
  ChevronLeft,
  Gift,
  Percent,
  Truck,
  Package,
} from "lucide-react";
import { useCartStore } from "@/store";

interface ProductPromotion {
  id: string;
  name: string;
  type: string;
  value: number;
  description: string | null;
  code: string | null;
  minQuantity: number | null;
}

interface LocalProductProps {
  product: {
    id: string;
    name: unknown;
    slug: string;
    description: unknown;
    sku: string | null;
    price: number;
    salePrice: number | null;
    image1: string | null;
    image2: string | null;
    image3: string | null;
    category: { id: string; name: unknown; slug: string } | null;
    brand: { id: string; name: unknown; slug: string } | null;
    gender: string | null;
    onSale: boolean;
    color: string | null;
    colorHex: string | null;
    material: string | null;
    weight: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
    countryOfOrigin: string | null;
    careInstructions: unknown;
    tags: string[];
    sizes: { size: string; stock: number }[];
  };
  promotions: ProductPromotion[];
}

export default function LocalProductDetail({
  product,
  promotions,
}: LocalProductProps) {
  const locale = useLocale();
  const displayName = getLocalized(product.name, locale);
  const displayDesc = getLocalized(product.description, locale);
  const careInstructions = getLocalized(product.careInstructions, locale);
  const brandName = product.brand ? getLocalized(product.brand.name, locale) : "";
  const categoryName = product.category ? getLocalized(product.category.name, locale) : "";

  const availableSizes = product.sizes.filter((size) => size.stock > 0);
  const [selectedSize, setSelectedSize] = useState<string | null>(
    availableSizes.length === 1 ? availableSizes[0].size : null,
  );
  const [activeImage, setActiveImage] = useState(0);
  const [showAdded, setShowAdded] = useState(false);
  const { addItem, items: cartItems } = useCartStore();

  const images = [product.image1, product.image2, product.image3].filter(
    Boolean,
  ) as string[];
  const effectivePrice = product.salePrice || product.price;
  const hasDiscount = product.salePrice && product.salePrice < product.price;
  const discountPercent = hasDiscount
    ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
    : 0;

  const totalStock = product.sizes.reduce((sum, s) => sum + s.stock, 0);
  const selectedVariant = product.sizes.find((size) => size.size === selectedSize);
  const quantityInCart = selectedSize
    ? cartItems.find((item) => item.id === product.id && item.size === selectedSize)?.quantity || 0
    : 0;
  const isAtStockLimit = Boolean(
    selectedVariant && quantityInCart >= selectedVariant.stock,
  );
  const canAddToCart = totalStock > 0 && Boolean(selectedVariant) && !isAtStockLimit;
  const formatPrice = (p: number) =>
    new Intl.NumberFormat("sr-RS").format(p) + " RSD";

  const handleAddToCart = () => {
    if (!selectedVariant || selectedVariant.stock <= 0) {
      return;
    }
    addItem({
      id: product.id,
      code: product.sku || product.id,
      name: displayName,
      size: selectedSize || "Jedna veličina",
      quantity: 1,
      stock: selectedVariant.stock,
      price: product.price,
      price1: effectivePrice,
      picture: product.image1 || undefined,
    });
    setShowAdded(true);
    setTimeout(() => setShowAdded(false), 2000);
  };

  const PromoIcon = ({ type }: { type: string }) => {
    switch (type) {
      case "BUY_X_GET_Y_FREE":
      case "BUY_X_GET_PERCENT":
        return <Gift className="h-4 w-4" />;
      case "FREE_SHIPPING":
        return <Truck className="h-4 w-4" />;
      default:
        return <Percent className="h-4 w-4" />;
    }
  };

  return (
    <div>
      {/* Back link */}
      <Link
        href="/catalog"
        className="inline-flex items-center gap-1 text-stone-500 hover:text-stone-900 mb-6 text-sm"
      >
        <ChevronLeft className="h-4 w-4" /> Nazad na katalog
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Images */}
        <div>
          <div className="relative aspect-square bg-stone-100 rounded-xl overflow-hidden mb-4">
            {images.length > 0 ? (
              <Image
                src={images[activeImage]}
                alt={displayName}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-stone-400">
                <Package className="h-16 w-16" />
              </div>
            )}
            {hasDiscount && (
              <span className="absolute top-4 left-4 bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                -{discountPercent}%
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-3">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImage(i)}
                  className={`relative w-20 h-20 rounded-lg overflow-hidden border-2 ${i === activeImage ? "border-stone-900" : "border-stone-200"}`}
                >
                  <Image
                    src={img}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          {/* Brand & Category */}
          <div className="flex items-center gap-2 text-sm text-stone-500">
            {product.brand && <span>{brandName}</span>}
            {product.brand && product.category && <span>/</span>}
            {product.category && <span>{categoryName}</span>}
          </div>

          <h1 className="text-2xl lg:text-3xl font-display font-bold text-stone-900">
            {displayName}
          </h1>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-stone-900">
              {formatPrice(effectivePrice)}
            </span>
            {hasDiscount && (
              <span className="text-lg text-stone-400 line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>

          {/* Promotions badges */}
          {promotions.length > 0 && (
            <div className="space-y-2">
              {promotions.map((promo) => (
                <div
                  key={promo.id}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm"
                >
                  <PromoIcon type={promo.type} />
                  <span className="font-medium text-amber-800">
                    {promo.name}
                  </span>
                  {promo.code && (
                    <span className="ml-auto text-xs bg-amber-100 px-2 py-0.5 rounded">
                      Kod: {promo.code}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Color */}
          {product.color && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-stone-600">Boja:</span>
              <div className="flex items-center gap-2">
                {product.colorHex && (
                  <div
                    className="w-6 h-6 rounded-full border border-stone-300"
                    style={{ backgroundColor: product.colorHex }}
                  />
                )}
                <span className="text-sm font-medium text-stone-900">
                  {product.color}
                </span>
              </div>
            </div>
          )}

          {/* Size selector */}
          {product.sizes.length > 0 && (
            <div>
              <p className="text-sm font-medium text-stone-700 mb-2">
                Veličina
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s.size}
                    type="button"
                    onClick={() => {
                      if (s.stock > 0) {
                        setSelectedSize(s.size);
                      }
                    }}
                    disabled={s.stock === 0}
                    aria-pressed={selectedSize === s.size}
                    aria-label={`${s.size}${s.stock === 0 ? ", nema na stanju" : ""}`}
                    className={`px-4 py-2 rounded-lg text-sm border-2 transition-colors
                      ${
                        selectedSize === s.size
                          ? "border-stone-900 bg-stone-900 text-white"
                          : s.stock > 0
                            ? "border-stone-200 hover:border-stone-400"
                            : "border-stone-100 text-stone-300 cursor-not-allowed line-through"
                      }`}
                  >
                    {s.size}
                  </button>
                ))}
              </div>
              {selectedSize && (
                <p className="text-xs text-stone-500 mt-1">
                  Na stanju:{" "}
                  {product.sizes.find((s) => s.size === selectedSize)?.stock}{" "}
                  kom
                </p>
              )}
            </div>
          )}

          {/* Add to cart */}
          <div className="flex gap-3">
            <button
              onClick={handleAddToCart}
              disabled={!canAddToCart}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-white transition-colors
                ${showAdded ? "bg-green-600" : !canAddToCart ? "bg-stone-300 cursor-not-allowed" : "bg-stone-900 hover:bg-stone-800"}`}
            >
              {showAdded ? (
                <>
                  <Check className="h-5 w-5" /> Dodato!
                </>
              ) : totalStock === 0 ? (
                "Nema na stanju"
              ) : !selectedVariant ? (
                "Izaberite veličinu"
              ) : isAtStockLimit ? (
                "Maksimalna količina je u korpi"
              ) : (
                <>
                  <ShoppingBag className="h-5 w-5" /> Dodaj u korpu
                </>
              )}
            </button>
          </div>

          {/* Product details accordion */}
          <div className="divide-y divide-stone-200 border-t border-b border-stone-200">
            {displayDesc && (
              <details className="py-4" open>
                <summary className="font-medium text-stone-900 cursor-pointer">
                  Opis
                </summary>
                <div
                  className="mt-2 text-sm text-stone-600 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: displayDesc }}
                />
              </details>
            )}
            {product.material && (
              <details className="py-4">
                <summary className="font-medium text-stone-900 cursor-pointer">
                  Materijal / Sastav
                </summary>
                <p className="mt-2 text-sm text-stone-600">
                  {product.material}
                </p>
              </details>
            )}
            {(product.weight || product.length) && (
              <details className="py-4">
                <summary className="font-medium text-stone-900 cursor-pointer">
                  Dimenzije i težina
                </summary>
                <div className="mt-2 text-sm text-stone-600 space-y-1">
                  {product.weight && <p>Težina: {Number(product.weight)} g</p>}
                  {product.length && <p>Dužina: {Number(product.length)} cm</p>}
                  {product.width && <p>Širina: {Number(product.width)} cm</p>}
                  {product.height && <p>Visina: {Number(product.height)} cm</p>}
                </div>
              </details>
            )}
            {careInstructions && (
              <details className="py-4">
                <summary className="font-medium text-stone-900 cursor-pointer">
                  Uputstva za održavanje
                </summary>
                <p className="mt-2 text-sm text-stone-600">
                  {careInstructions}
                </p>
              </details>
            )}
            {product.countryOfOrigin && (
              <details className="py-4">
                <summary className="font-medium text-stone-900 cursor-pointer">
                  Poreklo
                </summary>
                <p className="mt-2 text-sm text-stone-600">
                  Zemlja porekla: {product.countryOfOrigin}
                </p>
              </details>
            )}
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-stone-100 text-stone-600 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* SKU */}
          {product.sku && (
            <p className="text-xs text-stone-400">Šifra: {product.sku}</p>
          )}
        </div>
      </div>
    </div>
  );
}
