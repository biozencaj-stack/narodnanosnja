'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { useCartStore, useCartTotals } from '@/store';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter
} from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { toImageDataUri } from '@/lib/utils/image';
import { formatPriceWithCurrency } from '@/lib/utils/format';
import { useCartPricing } from '@/components/checkout';

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQuantity } = useCartStore();
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

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const getQuotedLine = (item: typeof items[0]) => {
    const productLines = quotedLines.filter((line) => line.productId === item.id);
    return (
      productLines.find((line) => line.size === item.size) ||
      (productLines.length === 1 ? productLines[0] : undefined)
    );
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <DrawerContent side="right">
        <DrawerHeader>
          <DrawerTitle>
            Korpa ({totalItems})
          </DrawerTitle>
        </DrawerHeader>

        <DrawerBody>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ShoppingBag className="h-16 w-16 text-text-light mb-4" />
              <h3 className="text-lg font-medium text-text mb-2">
                Vaša korpa je prazna
              </h3>
              <p className="text-text-muted mb-6">
                Dodajte proizvode u korpu da biste nastavili sa kupovinom.
              </p>
              <Button onClick={closeCart} asChild>
                <Link href="/catalog">
                  Pregledaj ponudu
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Cart items */}
              <div className="space-y-4">
                {items.map((item) => {
                  const quotedLine = getQuotedLine(item);
                  return <div
                    key={`${item.id}-${item.size}`}
                    className="flex gap-4 p-4 bg-background-alt rounded-lg"
                  >
                    {/* Image */}
                    <div className="flex-shrink-0 w-20 h-20 bg-white rounded-md overflow-hidden">
                      {item.picture ? (
                        <Image
                          src={toImageDataUri(item.picture)}
                          alt={item.name}
                          width={80}
                          height={80}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-light">
                          <ShoppingBag className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-text truncate">
                        {item.name}
                      </h4>
                      <p className="text-sm text-text-muted mt-0.5">
                        Veličina: {item.size}
                      </p>
                      <p className="text-sm font-medium text-primary mt-1">
                        {quotedLine
                          ? formatPriceWithCurrency(quotedLine.unitPrice)
                          : isLoadingQuote
                            ? "Provera cene…"
                            : "Cena nije dostupna"}
                      </p>

                      {/* Quantity controls */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center border border-border rounded-md">
                          <button
                            onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                            className="p-1.5 hover:bg-background-hover transition-colors"
                            aria-label="Smanji količinu"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="px-3 text-sm font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                            disabled={item.stock !== undefined && item.quantity >= item.stock}
                            className="p-1.5 hover:bg-background-hover transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={item.stock !== undefined
                              ? `Povećaj količinu, najviše ${item.stock}`
                              : "Povećaj količinu"}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(item.id, item.size)}
                          className="p-1.5 text-text-muted hover:text-error transition-colors"
                          aria-label="Ukloni proizvod"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>;
                })}
              </div>
            </>
          )}
        </DrawerBody>

        {items.length > 0 && (
          <DrawerFooter>
            {/* Summary */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Međuzbir</span>
                <span>{formatPriceWithCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Dostava</span>
                <span>{formatPriceWithCurrency(shipping)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-2 border-t border-border">
                <span>Ukupno</span>
                <span className="text-primary">{formatPriceWithCurrency(total)}</span>
              </div>
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

            {/* Actions */}
            <div className="space-y-2">
              {isLoadingQuote || quoteError ? (
                <Button fullWidth disabled>
                  {isLoadingQuote ? "Provera korpe..." : "Korpa zahteva izmenu"}
                </Button>
              ) : (
                <Button fullWidth asChild>
                  <Link href="/checkout" onClick={closeCart}>
                    Nastavi na plaćanje
                  </Link>
                </Button>
              )}
              <Button variant="secondary" fullWidth asChild>
                <Link href="/cart" onClick={closeCart}>
                  Pregled korpe
                </Link>
              </Button>
            </div>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
