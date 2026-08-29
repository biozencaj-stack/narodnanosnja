'use client';

import Image from 'next/image';
import { ChevronDown, ShoppingBag, Tag, Percent, Gift, Truck } from 'lucide-react';
import { useCartStore, useCartTotals } from '@/store';
import { toImageDataUri } from '@/lib/utils/image';
import { formatPriceWithCurrency } from '@/lib/utils/format';
import { useCheckoutPricing } from './CheckoutPricingProvider';
import { CouponInput } from './CouponInput';

const PromoIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "BUY_X_GET_Y_FREE":
    case "BUY_X_GET_PERCENT":
      return <Gift className="h-3.5 w-3.5" />;
    case "FREE_SHIPPING":
      return <Truck className="h-3.5 w-3.5" />;
    case "QUANTITY_DISCOUNT":
      return <Tag className="h-3.5 w-3.5" />;
    default:
      return <Percent className="h-3.5 w-3.5" />;
  }
};

export function OrderSummary() {
  const { items } = useCartStore();
  const { totalItems } = useCartTotals();
  const {
    promotions,
    totalDiscount,
    freeShipping,
    couponCode,
    couponError,
    isLoadingCoupon,
    isLoadingQuote,
    quoteError,
    applyCoupon,
    removeCoupon,
    finalTotal,
    finalShipping,
    subtotal,
    quotedLines,
  } = useCheckoutPricing();

  const getQuotedLine = (item: typeof items[0]) => {
    const productLines = quotedLines.filter((line) => line.productId === item.id);
    return (
      productLines.find((line) => line.size === item.size) ||
      (productLines.length === 1 ? productLines[0] : undefined)
    );
  };

  const couponDiscount = promotions.find(p => p.type !== "FREE_SHIPPING")?.discount || null;

  return (
    <details className="group rounded-xl bg-background-alt">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl p-4 marker:content-none lg:hidden [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-semibold text-text">
            Pregled porudžbine ({totalItems})
          </span>
          <span className="mt-0.5 block text-xs text-text-muted">
            {quoteError ? "Potrebna je provera korpe" : "Stavke, kupon i dostava"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-right">
          <span aria-live="polite">
            <span className="block text-xs text-text-muted">Ukupno</span>
            <span className="block font-semibold text-primary">
              {isLoadingQuote ? "Provera…" : formatPriceWithCurrency(finalTotal)}
            </span>
          </span>
          <ChevronDown
            className="h-5 w-5 text-text-muted transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>

      <div className="hidden p-4 pt-0 group-open:block lg:block lg:p-6">
        <h2 className="mb-6 hidden text-lg font-semibold text-text lg:block">
          Vaša porudžbina ({totalItems})
        </h2>

      {isLoadingQuote && (
        <p className="mb-4 text-sm text-text-muted" role="status">
          Proveravamo cene i dostupnost…
        </p>
      )}
      {quoteError && (
        <div className="mb-4 rounded-lg border border-error/20 bg-error-light p-3" role="alert">
          <p className="text-sm text-error">{quoteError}</p>
        </div>
      )}

      {/* Items */}
      <div className="space-y-4 mb-6">
        {items.map((item) => {
          const quotedLine = getQuotedLine(item);
          return <div
            key={`${item.id}-${item.size}`}
            className="flex gap-3"
          >
            <div className="relative flex-shrink-0 w-16 h-16 bg-white rounded-lg overflow-hidden">
              {item.picture ? (
                <Image
                  src={toImageDataUri(item.picture)}
                  alt={item.name}
                  fill
                  className="object-contain p-1"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-text-light">
                  <ShoppingBag className="h-6 w-6" />
                </div>
              )}
              <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center bg-primary text-white text-xs font-medium rounded-full">
                {item.quantity}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text truncate">
                {item.name}
              </p>
              <p className="text-xs text-text-muted">
                Veličina: {item.size}
              </p>
              <p className="text-sm font-medium text-text mt-1">
                {quotedLine
                  ? formatPriceWithCurrency(quotedLine.lineTotal)
                  : isLoadingQuote
                    ? "Provera cene…"
                    : "Cena nije dostupna"}
              </p>
            </div>
          </div>;
        })}
      </div>

      {/* Coupon Input */}
      <div className="mb-4">
        <CouponInput
          onApply={applyCoupon}
          onRemove={removeCoupon}
          appliedCode={couponCode}
          isLoading={isLoadingCoupon}
          error={couponError}
          discount={couponDiscount}
        />
      </div>

      {/* Totals */}
      <div className="space-y-3 pt-4 border-t border-border">
        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Međuzbir</span>
          <span>{formatPriceWithCurrency(subtotal)}</span>
        </div>

        {/* Applied promotions */}
        {promotions.length > 0 && (
          <div className="space-y-2">
            {promotions.map((promo) => (
              <div key={promo.id} className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5 text-green-700">
                  <PromoIcon type={promo.type} />
                  {promo.description}
                </span>
                {promo.discount > 0 && (
                  <span className="text-green-700 font-medium">
                    -{formatPriceWithCurrency(promo.discount)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Total discount line */}
        {totalDiscount > 0 && (
          <div className="flex justify-between text-sm font-medium text-green-700 pt-1">
            <span>Ukupni popust</span>
            <span>-{formatPriceWithCurrency(totalDiscount)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-text-muted">Dostava</span>
          {freeShipping ? (
            <span className="text-green-700 font-medium">Besplatno</span>
          ) : (
            <span>{formatPriceWithCurrency(finalShipping)}</span>
          )}
        </div>
      </div>

        <div className="flex justify-between text-xl font-semibold pt-4 mt-4 border-t border-border">
          <span>Ukupno</span>
          <span className="text-primary">{formatPriceWithCurrency(finalTotal)}</span>
        </div>
      </div>
    </details>
  );
}
