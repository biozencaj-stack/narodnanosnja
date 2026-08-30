import {
  ORDER_RESERVATION_WINDOWS,
  type OrderReservationWindows,
} from "@/lib/config/order-reservations";

export type ReservationPaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "REVIEW"
  | "REFUNDED";

export type ReservationOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "CANCELLED";

export interface ReservationTransactionSnapshot {
  status: string;
  createdAt: Date;
}

export interface InventoryReservationSnapshot {
  paymentMethod: string;
  paymentStatus: ReservationPaymentStatus;
  orderStatus: ReservationOrderStatus;
  inventoryAllocated: boolean;
  orderCreatedAt: Date;
  transaction: ReservationTransactionSnapshot | null;
  paymentEventCount: number;
  latestPaymentEventAt?: Date | null;
}

export type ReservationSkipReason =
  | "NON_CARD_ORDER"
  | "ORDER_NOT_PENDING"
  | "INVENTORY_NOT_ALLOCATED"
  | "PAYMENT_NOT_ACTIVE"
  | "PENDING_RECOVERY_WINDOW_ACTIVE"
  | "PROCESSING_REVIEW_WINDOW_ACTIVE"
  | "INVALID_POLICY_INPUT";

export type ReservationReviewReason =
  | "STALE_PENDING_WITH_PAYMENT_ACTIVITY"
  | "STALE_PROCESSING_PAYMENT"
  | "STALE_PROCESSING_WITHOUT_TRANSACTION"
  | "ACTIVE_ORDER_WITH_TERMINAL_TRANSACTION";

export type InventoryReservationDecision =
  | { action: "SKIP"; reason: ReservationSkipReason }
  | { action: "EXPIRE"; reason: "ABANDONED_PENDING_RESERVATION" }
  | { action: "REVIEW"; reason: ReservationReviewReason };

const TERMINAL_TRANSACTION_STATUSES = new Set([
  "APPROVED",
  "DECLINED",
  "REVIEW",
]);

function validTimestamp(value: Date | null | undefined): number | null {
  if (!value) return null;
  const timestamp = value.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function validWindow(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Pure policy for abandoned inventory reservations. It never releases stock
 * after any payment activity: an old active attempt is escalated to REVIEW,
 * while only a CARD/PENDING order with no transaction or callback events can
 * expire automatically.
 */
export function decideInventoryReservation(
  state: InventoryReservationSnapshot,
  now: Date,
  windows: OrderReservationWindows = ORDER_RESERVATION_WINDOWS,
): InventoryReservationDecision {
  if (state.paymentMethod !== "CARD") {
    return { action: "SKIP", reason: "NON_CARD_ORDER" };
  }
  if (state.orderStatus !== "PENDING") {
    return { action: "SKIP", reason: "ORDER_NOT_PENDING" };
  }
  if (!state.inventoryAllocated) {
    return { action: "SKIP", reason: "INVENTORY_NOT_ALLOCATED" };
  }
  if (!(["PENDING", "PROCESSING"] as string[]).includes(state.paymentStatus)) {
    return { action: "SKIP", reason: "PAYMENT_NOT_ACTIVE" };
  }

  if (
    state.transaction &&
    TERMINAL_TRANSACTION_STATUSES.has(state.transaction.status)
  ) {
    return {
      action: "REVIEW",
      reason: "ACTIVE_ORDER_WITH_TERMINAL_TRANSACTION",
    };
  }

  const nowMs = validTimestamp(now);
  const orderCreatedAtMs = validTimestamp(state.orderCreatedAt);
  const transactionCreatedAtMs = validTimestamp(state.transaction?.createdAt);
  const latestEventAtMs = validTimestamp(state.latestPaymentEventAt);
  if (
    nowMs === null ||
    orderCreatedAtMs === null ||
    (state.transaction !== null && transactionCreatedAtMs === null) ||
    (state.latestPaymentEventAt != null && latestEventAtMs === null) ||
    !Number.isSafeInteger(state.paymentEventCount) ||
    state.paymentEventCount < 0 ||
    !validWindow(windows.pendingRecoveryMs) ||
    !validWindow(windows.processingReviewMs)
  ) {
    return { action: "SKIP", reason: "INVALID_POLICY_INPUT" };
  }

  const hasPaymentEvents =
    state.paymentEventCount > 0 || latestEventAtMs !== null;
  const hasPaymentActivity = state.transaction !== null || hasPaymentEvents;

  if (state.paymentStatus === "PENDING" && !hasPaymentActivity) {
    return nowMs >= orderCreatedAtMs + windows.pendingRecoveryMs
      ? { action: "EXPIRE", reason: "ABANDONED_PENDING_RESERVATION" }
      : { action: "SKIP", reason: "PENDING_RECOVERY_WINDOW_ACTIVE" };
  }

  // A recent transaction/event extends the review clock. Missing timestamps
  // deliberately fall back to order creation and can only lead to REVIEW.
  const activityAnchorMs = Math.max(
    orderCreatedAtMs,
    transactionCreatedAtMs ?? orderCreatedAtMs,
    latestEventAtMs ?? orderCreatedAtMs,
  );
  if (nowMs < activityAnchorMs + windows.processingReviewMs) {
    return { action: "SKIP", reason: "PROCESSING_REVIEW_WINDOW_ACTIVE" };
  }

  if (state.paymentStatus === "PENDING") {
    return {
      action: "REVIEW",
      reason: "STALE_PENDING_WITH_PAYMENT_ACTIVITY",
    };
  }
  if (!state.transaction) {
    return {
      action: "REVIEW",
      reason: "STALE_PROCESSING_WITHOUT_TRANSACTION",
    };
  }
  return { action: "REVIEW", reason: "STALE_PROCESSING_PAYMENT" };
}
