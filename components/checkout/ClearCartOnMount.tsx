'use client';

import { useEffect } from 'react';
import { useCartStore } from '@/store';
import { clearPendingCardPayment } from '@/lib/payments/pending-card';
import { readPendingCardPayment } from '@/lib/payments/pending-card';
import { consumeCartClearMarker } from '@/lib/checkout/cart-clear';
import { clearCheckoutAttemptForOrder } from '@/lib/checkout/idempotency';

/**
 * Client component that clears the cart when the success page mounts.
 * Used by both /order/success (cash) and /payment/success (card).
 */
export function ClearCartOnMount({ orderId }: { orderId: string }) {
  const clearCart = useCartStore((state) => state.clearCart);
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (readPendingCardPayment()?.orderId === orderId) {
      clearPendingCardPayment();
    }
    clearCheckoutAttemptForOrder(orderId);
    if (consumeCartClearMarker(orderId, items)) {
      clearCart();
    }
  }, [clearCart, hasHydrated, items, orderId]);

  return null;
}
