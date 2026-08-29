'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCartStore, useCartTotals } from '@/store';
import { Button } from '@/components/ui/Button';
import { toImageDataUri } from '@/lib/utils/image';
import { formatPriceWithCurrency } from '@/lib/utils/format';
import { useCartPricing } from '@/components/checkout';
import { storeCapabilities } from '@/lib/config/capabilities';

export default function CartPage() {
  const { items, removeItem, updateQuantity, clearCart } = useCartStore();
  const { totalItems } = useCartTotals();
  const {
    subtotal,
    finalShipping: shipping,
    finalTotal: total,
    isLoadingQuote,
    quoteError,
    couponCode,
    removeCoupon,
    quotedLines,
  } = useCartPricing();

  const getQuotedLine = (item: typeof items[0]) => {
    const productLines = quotedLines.filter((line) => line.productId === item.id);
    return (
      productLines.find((line) => line.size === item.size) ||
      (productLines.length === 1 ? productLines[0] : undefined)
    );
  };

  if (items.length === 0) {
    return (
      <div className="container-wide py-16 lg:py-24">
        <div className="max-w-md mx-auto text-center">
          <ShoppingBag className="h-20 w-20 text-text-light mx-auto mb-6" />
          <h1 className="font-display text-2xl text-text mb-4">
            Vaša korpa je prazna
          </h1>
          <p className="text-text-muted mb-8">
            Dodajte proizvode u korpu da biste nastavili sa kupovinom.
          </p>
          <Button size="lg" asChild>
            <Link href="/catalog">
              Pregledaj ponudu
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container-wide py-8 lg:py-12">
      <h1 className="font-display text-3xl lg:text-4xl text-text mb-8">
        Korpa ({totalItems})
      </h1>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Cart items */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            {items.map((item) => {
              const quotedLine = getQuotedLine(item);
              return <div
                key={`${item.id}-${item.size}`}
                className="flex gap-4 p-4 bg-background-alt rounded-xl"
              >
                {/* Image */}
                <Link
                  href={`/product/${item.id}`}
                  className="flex-shrink-0 w-24 h-24 lg:w-32 lg:h-32 bg-white rounded-lg overflow-hidden"
                >
                  {item.picture ? (
                    <Image
                      src={toImageDataUri(item.picture)}
                      alt={item.name}
                      width={128}
                      height={128}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-light">
                      <ShoppingBag className="h-10 w-10" />
                    </div>
                  )}
                </Link>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/product/${item.id}`}
                    className="text-base lg:text-lg font-medium text-text hover:text-primary transition-colors line-clamp-2"
                  >
                    {item.name}
                  </Link>
                  <p className="text-sm text-text-muted mt-1">
                    Veličina: {item.size}
                  </p>
                  <p className="text-lg font-semibold text-primary mt-2">
                    {quotedLine
                      ? formatPriceWithCurrency(quotedLine.unitPrice)
                      : isLoadingQuote
                        ? "Provera cene…"
                        : "Cena nije dostupna"}
                  </p>

                  {/* Quantity & remove - mobile */}
                  <div className="flex items-center justify-between mt-4 lg:hidden">
                    <div className="flex items-center border border-border rounded-md">
                      <button
                        onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                        className="p-2 hover:bg-background-hover transition-colors"
                        aria-label="Smanji količinu"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="px-4 text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                        disabled={item.stock !== undefined && item.quantity >= item.stock}
                        className="p-2 hover:bg-background-hover transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={item.stock !== undefined
                          ? `Povećaj količinu, najviše ${item.stock}`
                          : "Povećaj količinu"}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id, item.size)}
                      className="p-2 text-text-muted hover:text-error transition-colors"
                      aria-label="Ukloni proizvod"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Quantity & remove - desktop */}
                <div className="hidden lg:flex items-center gap-6">
                  <div className="flex items-center border border-border rounded-md">
                    <button
                      onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                      className="p-2 hover:bg-background-hover transition-colors"
                      aria-label="Smanji količinu"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="px-4 text-sm font-medium min-w-[40px] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                      disabled={item.stock !== undefined && item.quantity >= item.stock}
                      className="p-2 hover:bg-background-hover transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={item.stock !== undefined
                        ? `Povećaj količinu, najviše ${item.stock}`
                        : "Povećaj količinu"}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-lg font-semibold text-text min-w-[120px] text-right">
                    {quotedLine
                      ? formatPriceWithCurrency(quotedLine.lineTotal)
                      : isLoadingQuote
                        ? "Provera cene…"
                        : "Cena nije dostupna"}
                  </p>

                  <button
                    onClick={() => removeItem(item.id, item.size)}
                    className="p-2 text-text-muted hover:text-error transition-colors"
                    aria-label="Ukloni proizvod"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>;
            })}
          </div>

          {/* Clear cart */}
          <div className="mt-6">
            <Button variant="ghost" onClick={clearCart}>
              Isprazni korpu
            </Button>
          </div>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 p-6 bg-background-alt rounded-xl">
            <h2 className="text-lg font-semibold text-text mb-6">
              Pregled porudžbine
            </h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Međuzbir ({totalItems} artikala)</span>
                <span>{formatPriceWithCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Dostava</span>
                <span>{formatPriceWithCurrency(shipping)}</span>
              </div>
            </div>

            <div className="flex justify-between text-xl font-semibold pt-4 border-t border-border mb-6">
              <span>Ukupno</span>
              <span className="text-primary">{formatPriceWithCurrency(total)}</span>
            </div>

            {quoteError && (
              <div className="mb-4 rounded-lg border border-error/20 bg-error-light p-3" role="alert">
                <p className="text-sm text-error">{quoteError}</p>
                {couponCode && (
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="mt-2 text-sm font-medium text-primary underline underline-offset-2"
                  >
                    Ukloni kupon {couponCode}
                  </button>
                )}
              </div>
            )}

            {isLoadingQuote || quoteError ? (
              <Button size="lg" fullWidth disabled>
                {isLoadingQuote ? "Provera korpe..." : "Korpa zahteva izmenu"}
              </Button>
            ) : (
              <Button size="lg" fullWidth asChild>
                <Link href="/checkout">
                  Nastavi na plaćanje
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Link>
              </Button>
            )}

            <p className="mt-4 text-xs text-text-muted text-center">
              {storeCapabilities.cardPayments && storeCapabilities.cashOnDelivery
                ? 'Sigurno plaćanje karticama ili pouzećem'
                : storeCapabilities.cardPayments
                  ? 'Sigurno kartično plaćanje'
                  : storeCapabilities.cashOnDelivery
                    ? 'Plaćanje pouzećem'
                    : 'Načini plaćanja trenutno nisu dostupni'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
