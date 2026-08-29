'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import {
  CheckoutForm,
  OrderSummary,
  PendingCardRecovery,
} from '@/components/checkout';
import { useCartStore } from '@/store';
import { readPendingCardPayment } from '@/lib/payments/pending-card';

function CheckoutLoading({ message }: { message: string }) {
  return (
    <div
      className="container-wide py-8 lg:py-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{message}</span>
      <div className="mb-8 h-5 w-32 animate-pulse rounded bg-background-alt" />
      <div className="mb-8 h-10 w-48 animate-pulse rounded bg-background-alt" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-12">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-28 animate-pulse rounded-xl bg-background-alt" />
          <div className="h-44 animate-pulse rounded-xl bg-background-alt" />
          <div className="h-56 animate-pulse rounded-xl bg-background-alt" />
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-background-alt lg:col-span-1" />
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, hasHydrated } = useCartStore();
  const [pendingOrderId, setPendingOrderId] = useState<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (hasHydrated) {
      const queryOrderId = new URLSearchParams(window.location.search).get(
        'recover',
      );
      const safeQueryOrderId =
        queryOrderId && /^[A-Za-z0-9_-]{1,128}$/.test(queryOrderId)
          ? queryOrderId
          : null;
      setPendingOrderId(
        safeQueryOrderId || readPendingCardPayment()?.orderId || null,
      );
    }
  }, [hasHydrated]);

  // Redirect if cart is empty
  useEffect(() => {
    if (hasHydrated && pendingOrderId === null && items.length === 0) {
      router.push('/cart');
    }
  }, [hasHydrated, items, pendingOrderId, router]);

  if (!hasHydrated || pendingOrderId === undefined) {
    return <CheckoutLoading message="Učitavamo vašu korpu i podatke za plaćanje." />;
  }

  if (pendingOrderId) {
    return (
      <div className="container-wide py-8 lg:py-12">
        <h1 className="mb-8 font-display text-3xl text-text lg:text-4xl">
          Plaćanje
        </h1>
        <PendingCardRecovery orderId={pendingOrderId} />
      </div>
    );
  }

  if (items.length === 0) {
    return <CheckoutLoading message="Korpa je prazna. Vraćamo vas u korpu." />;
  }

  return (
    <div className="container-wide py-8 lg:py-12">
      {/* Back link */}
      <Link
        href="/cart"
        className="inline-flex items-center text-sm text-text-muted hover:text-primary transition-colors mb-8"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Nazad u korpu
      </Link>

      <h1 className="font-display text-3xl lg:text-4xl text-text mb-8">
        Plaćanje
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Jedan pregled: pre forme na telefonu, sticky sidebar na desktopu. */}
        <div className="order-1 lg:order-2 lg:col-span-1">
          <div className="lg:sticky lg:top-24">
            <OrderSummary />
          </div>
        </div>

        {/* Form */}
        <div className="order-2 lg:order-1 lg:col-span-2">
          <CheckoutForm />
        </div>
      </div>
    </div>
  );
}
