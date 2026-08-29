"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CreditCard, Package } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatPriceWithCurrency } from "@/lib/utils/format";
import {
  PaymentStartClientError,
  submitNestPayHandoff,
} from "@/lib/payments/browser-handoff";
import { clearPendingCardPayment } from "@/lib/payments/pending-card";
import {
  clearCheckoutAttemptForOrder,
  getCheckoutIdempotencyKeyForOrder,
} from "@/lib/checkout/idempotency";

interface RecoveryOrder {
  id: string;
  orderNumber: string;
  paymentMethod: string;
  paymentStatus: string;
  total: number | string;
  items: Array<{
    id: string;
    productName: string;
    size: string;
    quantity: number;
    price: number | string;
  }>;
}

export function PendingCardRecovery({
  orderId,
}: {
  orderId: string;
}) {
  const router = useRouter();
  const [order, setOrder] = useState<RecoveryOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const idempotencyKey = getCheckoutIdempotencyKeyForOrder(orderId);
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        cache: "no-store",
        headers: idempotencyKey
          ? { "Idempotency-Key": idempotencyKey }
          : undefined,
      });
      const data = (await response.json().catch(() => ({}))) as {
        order?: RecoveryOrder;
        error?: string;
      };
      if (!response.ok || !data.order) {
        throw new Error(
          data.error || "Rezervisana porudžbina trenutno ne može da se učita.",
        );
      }

      const loaded = data.order;
      if (loaded.paymentMethod !== "CARD") {
        clearPendingCardPayment();
        clearCheckoutAttemptForOrder(orderId);
        router.replace(`/order/success?oid=${encodeURIComponent(orderId)}`);
        return;
      }
      if (loaded.paymentStatus === "PAID") {
        clearPendingCardPayment();
        router.replace(`/payment/success?oid=${encodeURIComponent(orderId)}`);
        return;
      }
      if (loaded.paymentStatus === "REFUNDED") {
        clearPendingCardPayment();
        clearCheckoutAttemptForOrder(orderId);
        router.replace(`/payment/failed?oid=${encodeURIComponent(orderId)}`);
        return;
      }
      if (["FAILED", "REVIEW"].includes(loaded.paymentStatus)) {
        router.replace(`/payment/failed?oid=${encodeURIComponent(orderId)}`);
        return;
      }
      setOrder(loaded);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Rezervisana porudžbina trenutno ne može da se učita.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const resumePayment = async () => {
    setIsStarting(true);
    setError(null);
    try {
      await submitNestPayHandoff(orderId);
    } catch (startError) {
      if (startError instanceof PaymentStartClientError) {
        if (startError.clearPending) {
          clearPendingCardPayment();
          if (!startError.review) clearCheckoutAttemptForOrder(orderId);
        }
        if (startError.review) {
          router.push(
            `/payment/failed?oid=${encodeURIComponent(orderId)}&error=payment_review`,
          );
          return;
        }
      }
      setError(
        startError instanceof Error
          ? startError.message
          : "Plaćanje trenutno ne može da se nastavi.",
      );
      setIsStarting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-white p-8 text-center" role="status">
        <p className="text-text-muted">Učitavamo rezervisanu porudžbinu…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="rounded-2xl border border-warning/30 bg-warning-light p-6" role="alert">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <h2 className="font-semibold text-text">Porudžbina je već rezervisana</h2>
            <p className="mt-2 text-sm text-text-muted">{error}</p>
            <p className="mt-2 text-sm text-text-muted">
              Ne kreirajte novu porudžbinu. Osvežite stranicu ili kontaktirajte
              podršku i navedite ID {orderId}.
            </p>
            <Button className="mt-5" variant="secondary" onClick={() => void loadOrder()}>
              Pokušaj ponovo
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-primary/20 bg-white p-6 lg:p-8">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-primary-light p-3">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-2xl text-text">
            Dovršite započeto plaćanje
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-muted">
            Porudžbina {order.orderNumber} je već rezervisana. Prikaz ispod je
            njen serverski snapshot; eventualne kasnije promene u korpi ne
            menjaju ovu porudžbinu.
          </p>
        </div>
      </div>

      <div className="mt-6 divide-y divide-border rounded-xl bg-background-alt px-4">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 py-4 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-text">{item.productName}</p>
              <p className="text-text-muted">
                {item.size} · {item.quantity} kom.
              </p>
            </div>
            <p className="shrink-0 font-semibold text-text">
              {formatPriceWithCurrency(Number(item.price) * item.quantity)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-border p-4">
        <span className="flex items-center gap-2 font-medium text-text">
          <Package className="h-5 w-5 text-primary" /> Ukupno
        </span>
        <span className="text-xl font-semibold text-primary">
          {formatPriceWithCurrency(Number(order.total))}
        </span>
      </div>

      {error && (
        <div className="mt-5 rounded-lg bg-error-light p-3 text-sm text-error" role="alert">
          {error}
        </div>
      )}

      <Button
        className="mt-6"
        size="xl"
        fullWidth
        isLoading={isStarting}
        disabled={isStarting}
        onClick={() => void resumePayment()}
      >
        Nastavi bezbedno plaćanje
      </Button>
      <p className="mt-3 text-center text-xs text-text-muted">
        Nova porudžbina neće biti kreirana.
      </p>
    </section>
  );
}
