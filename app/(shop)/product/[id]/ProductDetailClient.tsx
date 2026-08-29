'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Check } from 'lucide-react';
import { ProductGallery } from '@/components/product/ProductGallery';
import { SizeSelector } from '@/components/product/SizeSelector';
import { ProductAccordion, ProductVideo } from '@/components/product/ProductAccordion';
import { SizeGuideDialog } from '@/components/product/SizeGuideDialog';
import { SocialShare } from '@/components/product/SocialShare';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { useCartStore, useUIStore } from '@/store';
import { useRecentlyViewed } from '@/hooks/useRecentlyViewed';
import { formatPriceWithCurrency, clearProductSufix } from '@/lib/utils/format';
import type { ProductDetail } from '@/types/product';

// Keywords to detect fashion accessories (wallets, bags, backpacks) by product name
const ACCESSORY_KEYWORDS = ['novčanik', 'novcanik', 'torba', 'ranac', 'ruksak'];

interface ProductDetailClientProps {
  product: Omit<ProductDetail, 'types'> & { types: Record<string, boolean> };
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [showAddedDialog, setShowAddedDialog] = useState(false);

  const { addItem, openCart } = useCartStore();
  const { openSizeGuide } = useUIStore();
  const { addItem: addToRecentlyViewed } = useRecentlyViewed();

  // Track product view in recently viewed
  useEffect(() => {
    addToRecentlyViewed({
      id: product.id,
      code: product.code,
      name: product.name,
      picture: product.picture,
      price: product.price,
      price1: product.price1,
      price2: product.price2,
      percent1: product.percent1,
      percent2: product.percent2,
    });
  }, [product.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    id,
    code,
    name,
    price,
    price1,
    price2,
    percent1,
    percent2,
    picture,
    pictureName,
    types,
    quantity,
    groupName,
    itemMaterial,
    itemPurpose,
    itemFactory,
    itemManuf,
    description,
    itemLength,
    itemWidth,
    itemHeight,
  } = product;

  // Determine prices (matching ProductCard logic for consistency)
  let currentPrice = price;
  let middlePrice: number | null = null; // price1 when both discounts exist
  let originalPrice: number | null = null;

  if (price2 && price2 > 0 && price2 < price) {
    currentPrice = price2;
    originalPrice = price;
    if (price1 && price1 > 0 && price1 < price) {
      middlePrice = price1;
    }
  } else if (price1 && price1 > 0 && price1 < price) {
    currentPrice = price1;
    originalPrice = price;
  }

  // Check for discounts - use !! to convert to boolean (prevents React rendering "0")
  const hasDiscount1 = !!(percent1 && percent1 > 0);
  const hasDiscount2 = !!(percent2 && percent2 > 0);

  // Detect accessories (wallets, bags, backpacks) by product name or groupName
  const productNameLower = name?.toLowerCase() || '';
  const isAccessory = ACCESSORY_KEYWORDS.some(keyword => productNameLower.includes(keyword))
    || groupName?.toLowerCase() === 'torbe';

  const isOutOfStock = quantity === 0;
  const canAddToCart = !isOutOfStock && (isAccessory || selectedSize !== null);

  const handleAddToCart = () => {
    if (!canAddToCart) return;

    addItem({
      id,
      code,
      name,
      size: selectedSize || 'Jedinstvena',
      price,
      price1,
      price2,
      picture,
      pictureName,
    });

    setShowAddedDialog(true);
    setSelectedSize(null);
  };

  return (
    <>
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link
          href="/catalog"
          className="inline-flex items-center text-sm text-text-muted hover:text-primary transition-colors"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Nazad na listu
        </Link>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div>
          <ProductGallery image={picture} alt={clearProductSufix(name)} />
        </div>

        {/* Details */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            {/* Discount badges - two separate boxes stacked */}
            {(hasDiscount1 || hasDiscount2) && (
              <div className="flex flex-col items-start gap-1 mb-3">
                {hasDiscount1 && (
                  <div className="bg-red-600 text-white text-base font-bold px-3.5 py-1.5 rounded-full">
                    -{percent1}%
                  </div>
                )}
                {hasDiscount2 && (
                  <div className="bg-blue-600 text-white text-base font-bold px-3.5 py-1.5 rounded-full">
                    -{percent2}%
                  </div>
                )}
              </div>
            )}
            <h1 className="font-display text-2xl lg:text-3xl text-text mb-2">
              {clearProductSufix(name)}
            </h1>
            <p className="text-sm text-text-muted">
              {code}
            </p>
          </div>

          {/* Stock status */}
          {isOutOfStock && (
            <div className="p-4 bg-error-light rounded-lg">
              <p className="text-sm text-error font-medium">
                Proizvod trenutno nije na stanju
              </p>
            </div>
          )}

          {/* Price */}
          <div className="space-y-1">
            {middlePrice ? (
              // Dva popusta - prikaži sve 3 cene
              <>
                <p className="text-3xl font-semibold text-error">
                  {formatPriceWithCurrency(currentPrice)}
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-text-muted line-through">
                    {formatPriceWithCurrency(originalPrice!)}
                  </p>
                  <p className="text-lg text-text-muted line-through">
                    {formatPriceWithCurrency(middlePrice)}
                  </p>
                </div>
              </>
            ) : originalPrice ? (
              // Jedan popust
              <>
                <p className="text-3xl font-semibold text-error">
                  {formatPriceWithCurrency(currentPrice)}
                </p>
                <p className="text-lg text-text-muted line-through">
                  {formatPriceWithCurrency(originalPrice)}
                </p>
              </>
            ) : (
              // Bez popusta
              <p className="text-3xl font-semibold text-text">
                {formatPriceWithCurrency(currentPrice)}
              </p>
            )}
          </div>

          {/* Accordion details - above button */}
          <ProductAccordion
            material={itemMaterial}
            purpose={itemPurpose}
            description={description}
            groupName={groupName}
            dimensions={{
              length: itemLength,
              width: itemWidth,
              height: itemHeight,
            }}
            factory={itemFactory}
            manufacturer={itemManuf}
            isBag={isAccessory}
          />

          {/* Size selector (not for accessories) */}
          {!isAccessory && (
            <SizeSelector
              sizes={types}
              selectedSize={selectedSize}
              onSelectSize={setSelectedSize}
              onOpenSizeGuide={openSizeGuide}
            />
          )}

          {/* Video section - only shows if video exists */}
          <ProductVideo groupName={groupName} />

          {/* Add to cart */}
          <Button
            size="xl"
            fullWidth
            onClick={handleAddToCart}
            disabled={!canAddToCart}
          >
            {isOutOfStock
              ? 'Nije na stanju'
              : !isAccessory && !selectedSize
                ? 'Izaberite veličinu'
                : 'Dodaj u korpu'
            }
          </Button>

          {/* Social Share */}
          <SocialShare
            url={typeof window !== 'undefined' ? window.location.href : `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/product/${id}`}
            title={clearProductSufix(name)}
            description={`${clearProductSufix(name)} - ${formatPriceWithCurrency(currentPrice)}`}
            className="pt-4 border-t border-border"
          />
        </div>
      </div>

      {/* Size guide dialog */}
      <SizeGuideDialog brand={groupName} productName={name} />

      {/* Added to cart dialog */}
      <Dialog open={showAddedDialog} onOpenChange={setShowAddedDialog}>
        <DialogContent className="max-w-md">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center w-10 h-10 bg-success-light rounded-full">
              <Check className="h-5 w-5 text-success" />
            </div>
            <DialogTitle>Proizvod je dodat u korpu!</DialogTitle>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowAddedDialog(false)}
              className="flex-1"
            >
              Nastavi kupovinu
            </Button>
            <Button
              onClick={() => {
                setShowAddedDialog(false);
                openCart();
              }}
              className="flex-1"
            >
              Idi u korpu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
