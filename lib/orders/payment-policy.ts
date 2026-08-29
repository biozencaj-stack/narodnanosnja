export type PaymentState =
  | "PENDING"
  | "PROCESSING"
  | "PAID"
  | "FAILED"
  | "REVIEW"
  | "REFUNDED";

export type OrderState =
  | "PENDING"
  | "CONFIRMED"
  | "SHIPPED"
  | "CANCELLED";

export type PaymentCallbackOutcome = "APPROVED" | "DECLINED";
export type PaymentTerminal = PaymentCallbackOutcome | "REVIEW";

export type PaymentCallbackDecision =
  | { action: "APPLY_APPROVED" }
  | { action: "APPLY_DECLINED" }
  | { action: "REPLAY"; terminal: PaymentCallbackOutcome }
  | { action: "REVIEW"; reason: string };

export type PaymentStartDecision =
  | { action: "START" }
  | { action: "REPLAY" }
  | { action: "REJECT"; reason: string };

export interface PaymentCallbackState {
  paymentMethod: string;
  paymentStatus: PaymentState;
  orderStatus: OrderState;
  inventoryAllocated: boolean;
  hasTrackedInventory: boolean;
  transactionStatus?: string | null;
  transactionId?: string | null;
}

function terminalStatus(status: string | null | undefined): PaymentTerminal | null {
  if (status === "APPROVED" || status === "DECLINED" || status === "REVIEW") {
    return status;
  }
  return null;
}

function transactionIdentityConflicts(
  existing: string | null | undefined,
  incoming: string | null | undefined,
) {
  return Boolean(existing && incoming && existing !== incoming);
}

/**
 * Čista politika payment prelaza. Terminalni rezultat Transaction zapisa je
 * neizmenjiv; svaki kontradiktorni callback ide u REVIEW umesto da pobednik
 * zavisi od redosleda paralelnih zahteva.
 */
export function decidePaymentCallback(
  state: PaymentCallbackState,
  incoming: {
    outcome: PaymentCallbackOutcome;
    transactionId?: string | null;
  },
): PaymentCallbackDecision {
  if (state.paymentMethod !== "CARD") {
    return { action: "REVIEW", reason: "NON_CARD_ORDER_CALLBACK" };
  }

  const terminal = terminalStatus(state.transactionStatus);
  if (terminal === "REVIEW" || state.paymentStatus === "REVIEW") {
    return { action: "REVIEW", reason: "PAYMENT_ALREADY_IN_REVIEW" };
  }

  if (terminal === "APPROVED" || terminal === "DECLINED") {
    if (terminal !== incoming.outcome) {
      return { action: "REVIEW", reason: "CONFLICTING_TERMINAL_CALLBACK" };
    }
    if (
      transactionIdentityConflicts(
        state.transactionId,
        incoming.transactionId,
      )
    ) {
      return { action: "REVIEW", reason: "PROVIDER_TRANSACTION_MISMATCH" };
    }

    const projectionMatches =
      terminal === "APPROVED"
        ? state.paymentStatus === "PAID" && state.orderStatus !== "CANCELLED"
        : state.paymentStatus === "FAILED" && state.orderStatus === "CANCELLED";

    return projectionMatches
      ? { action: "REPLAY", terminal }
      : { action: "REVIEW", reason: "ORDER_TRANSACTION_STATE_MISMATCH" };
  }

  if (incoming.outcome === "APPROVED") {
    if (!incoming.transactionId) {
      return { action: "REVIEW", reason: "MISSING_PROVIDER_TRANSACTION_ID" };
    }
    if (!["PENDING", "PROCESSING"].includes(state.paymentStatus)) {
      return { action: "REVIEW", reason: "APPROVAL_AFTER_TERMINAL_PAYMENT" };
    }
    if (["CANCELLED", "SHIPPED"].includes(state.orderStatus)) {
      return { action: "REVIEW", reason: "APPROVAL_FOR_CLOSED_ORDER" };
    }
    if (state.hasTrackedInventory && !state.inventoryAllocated) {
      return { action: "REVIEW", reason: "APPROVAL_WITHOUT_INVENTORY" };
    }
    return { action: "APPLY_APPROVED" };
  }

  if (!["PENDING", "PROCESSING"].includes(state.paymentStatus)) {
    return { action: "REVIEW", reason: "DECLINE_AFTER_TERMINAL_PAYMENT" };
  }
  if (state.orderStatus !== "PENDING") {
    return { action: "REVIEW", reason: "DECLINE_FOR_NON_PENDING_ORDER" };
  }
  if (state.hasTrackedInventory && !state.inventoryAllocated) {
    return { action: "REVIEW", reason: "DECLINE_WITHOUT_INVENTORY" };
  }

  return { action: "APPLY_DECLINED" };
}

export function decidePaymentStart(state: {
  paymentMethod: string;
  paymentStatus: PaymentState;
  orderStatus: OrderState;
  transactionStatus?: string | null;
}): PaymentStartDecision {
  if (state.paymentMethod !== "CARD") {
    return { action: "REJECT", reason: "NON_CARD_ORDER" };
  }
  if (state.orderStatus !== "PENDING") {
    return { action: "REJECT", reason: "ORDER_NOT_PENDING" };
  }

  const terminal = terminalStatus(state.transactionStatus);
  if (terminal || ["PAID", "FAILED", "REVIEW", "REFUNDED"].includes(state.paymentStatus)) {
    return { action: "REJECT", reason: "PAYMENT_ALREADY_TERMINAL" };
  }

  if (state.transactionStatus === "INITIATED") {
    return ["PENDING", "PROCESSING"].includes(state.paymentStatus)
      ? { action: "REPLAY" }
      : { action: "REJECT", reason: "INCONSISTENT_PAYMENT_START" };
  }

  if (state.paymentStatus === "PENDING") {
    return { action: "START" };
  }

  return { action: "REJECT", reason: "PAYMENT_START_NOT_ALLOWED" };
}
