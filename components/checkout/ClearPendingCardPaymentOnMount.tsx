"use client";

import { useEffect } from "react";
import {
  clearPendingCardPayment,
  readPendingCardPayment,
} from "@/lib/payments/pending-card";
import { clearCheckoutAttemptForOrder } from "@/lib/checkout/idempotency";

export function ClearPendingCardPaymentOnMount({
  orderId,
  clearCheckoutAttempt = false,
}: {
  orderId: string;
  clearCheckoutAttempt?: boolean;
}) {
  useEffect(() => {
    if (readPendingCardPayment()?.orderId === orderId) {
      clearPendingCardPayment();
    }
    if (clearCheckoutAttempt) {
      clearCheckoutAttemptForOrder(orderId);
    }
  }, [clearCheckoutAttempt, orderId]);
  return null;
}
