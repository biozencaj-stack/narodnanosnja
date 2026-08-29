"use client";

import { useEffect } from "react";
import {
  clearPendingCardPayment,
  clearTerminalCardPaymentAttempt,
  readPendingCardPayment,
} from "@/lib/payments/pending-card";

export function ClearPendingCardPaymentOnMount({
  orderId,
  clearCheckoutAttempt = false,
}: {
  orderId: string;
  clearCheckoutAttempt?: boolean;
}) {
  useEffect(() => {
    if (clearCheckoutAttempt) {
      clearTerminalCardPaymentAttempt(orderId);
      return;
    }
    if (readPendingCardPayment()?.orderId === orderId) {
      clearPendingCardPayment();
    }
  }, [clearCheckoutAttempt, orderId]);
  return null;
}
