import { prisma } from "@/lib/db";
import {
  Prisma,
  type OrderStatus,
  type PaymentStatus,
} from "@prisma/client";
import {
  decidePaymentCallback,
  decidePaymentStart,
  type PaymentCallbackOutcome,
  type PaymentState,
  type OrderState,
} from "./payment-policy";
import {
  InventoryReleaseError,
  releaseOrderInventoryInTransaction,
} from "./inventory";
import {
  CouponReleaseError,
  releaseOrderCouponInTransaction,
} from "./coupon";

const SERIALIZABLE_RETRIES = 3;
const TERMINAL_TRANSACTION_STATES = new Set([
  "APPROVED",
  "DECLINED",
  "REVIEW",
]);

export class PaymentStateError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 409,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "PaymentStateError";
  }
}

export interface StoredPaymentStartPayload {
  provider: "NESTPAY";
  actionUrl: string;
  nonce: string;
  fields: Record<string, string>;
}

interface PaymentStartOrderSnapshot {
  id: string;
  orderNumber: string;
  total: number;
  currency: string;
}

export type PaymentStartResult =
  | {
      kind: "STARTED" | "REPLAY";
      orderId: string;
      payload: StoredPaymentStartPayload;
    }
  | { kind: "REVIEW"; orderId: string; reason: string };

export interface ProcessPaymentCallbackInput {
  provider: "NESTPAY";
  orderNumber: string;
  eventKey: string;
  outcome: PaymentCallbackOutcome | "REVIEW";
  reviewReason?: string;
  transactionId?: string;
  authCode?: string;
  amount?: number | null;
  currency?: string | null;
  auditPayload: Record<string, string>;
}

export interface ProcessPaymentCallbackResult {
  kind: "APPLIED" | "REPLAY" | "REVIEW";
  callbackOutcome: PaymentCallbackOutcome | "REVIEW";
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  guestAccess: boolean;
  reason?: string;
}

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
}

async function serializableWithRetry<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: "Serializable",
      });
    } catch (error) {
      lastError = error;
      if (!["P2002", "P2034"].includes(errorCode(error)) || attempt === SERIALIZABLE_RETRIES) {
        throw error;
      }
    }
  }
  throw lastError;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every(
      (entry) => typeof entry === "string",
    )
  );
}

function parseStoredStartPayload(value: unknown): StoredPaymentStartPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (
    payload.provider !== "NESTPAY" ||
    typeof payload.actionUrl !== "string" ||
    typeof payload.nonce !== "string" ||
    !isStringRecord(payload.fields)
  ) {
    return null;
  }
  try {
    new URL(payload.actionUrl);
  } catch {
    return null;
  }
  return {
    provider: "NESTPAY",
    actionUrl: payload.actionUrl,
    nonce: payload.nonce,
    fields: payload.fields,
  };
}

export async function beginCardPayment(
  orderId: string,
  buildPayload: (
    order: PaymentStartOrderSnapshot,
  ) => StoredPaymentStartPayload,
): Promise<PaymentStartResult> {
  return serializableWithRetry(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { transaction: true },
    });
    if (!order) {
      throw new PaymentStateError(
        "Porudžbina nije pronađena",
        "ORDER_NOT_FOUND",
        404,
      );
    }

    const decision = decidePaymentStart({
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus as PaymentState,
      orderStatus: order.status as OrderState,
      transactionStatus: order.transaction?.status,
    });
    if (decision.action === "REJECT") {
      throw new PaymentStateError(
        "Porudžbina nije dostupna za novo plaćanje",
        decision.reason,
      );
    }

    if (decision.action === "REPLAY") {
      const payload = parseStoredStartPayload(order.transaction?.rawResponse);
      if (!payload) {
        if (
          order.transaction &&
          !TERMINAL_TRANSACTION_STATES.has(order.transaction.status)
        ) {
          await tx.transaction.update({
            where: { id: order.transaction.id },
            data: { status: "REVIEW" },
          });
        }
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "REVIEW" as PaymentStatus },
        });
        return {
          kind: "REVIEW",
          orderId: order.id,
          reason: "MISSING_PAYMENT_START_PAYLOAD",
        };
      }

      if (order.paymentStatus === "PENDING") {
        const repaired = await tx.order.updateMany({
          where: {
            id: order.id,
            paymentStatus: "PENDING",
            status: "PENDING",
          },
          data: { paymentStatus: "PROCESSING" as PaymentStatus },
        });
        if (repaired.count !== 1) {
          throw new PaymentStateError(
            "Stanje plaćanja je paralelno promenjeno",
            "PAYMENT_START_CONFLICT",
          );
        }
      }

      return { kind: "REPLAY", orderId: order.id, payload };
    }

    let payload: StoredPaymentStartPayload;
    try {
      payload = buildPayload({
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        currency: order.currency,
      });
    } catch (error) {
      const code =
        error instanceof PaymentStateError
          ? error.code
          : "PAYMENT_START_BUILD_FAILED";
      // Builder se izvršava pre bilo kog upisa. Bacanje vraća transakciju i
      // zadržava istu PENDING porudžbinu/rezervaciju za idempotentan retry sa
      // postojećim orderId + access tokenom, bez kreiranja nove porudžbine.
      throw new PaymentStateError(
        "Pokretanje plaćanja trenutno nije dostupno; ponovite isti zahtev",
        code,
        503,
        true,
      );
    }

    const rawResponse = payload as unknown as Prisma.InputJsonValue;
    if (order.transaction) {
      await tx.transaction.update({
        where: { id: order.transaction.id },
        data: {
          transId: null,
          authCode: null,
          amount: order.total,
          currency: order.currency,
          status: "INITIATED",
          rawResponse,
        },
      });
    } else {
      await tx.transaction.create({
        data: {
          orderId: order.id,
          amount: order.total,
          currency: order.currency,
          status: "INITIATED",
          rawResponse,
        },
      });
    }

    const started = await tx.order.updateMany({
      where: {
        id: order.id,
        paymentMethod: "CARD",
        paymentStatus: "PENDING",
        status: "PENDING",
      },
      data: { paymentStatus: "PROCESSING" as PaymentStatus },
    });
    if (started.count !== 1) {
      throw new PaymentStateError(
        "Stanje plaćanja je paralelno promenjeno",
        "PAYMENT_START_CONFLICT",
      );
    }

    return { kind: "STARTED", orderId: order.id, payload };
  });
}

async function writeTransactionSummary(
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    total: Prisma.Decimal;
    currency: string;
    transaction: {
      id: string;
      status: string;
    } | null;
  },
  input: ProcessPaymentCallbackInput,
  status: PaymentCallbackOutcome | "REVIEW",
) {
  const data = {
    transId: input.transactionId || null,
    authCode: status === "APPROVED" ? input.authCode || null : null,
    amount: order.total,
    currency: order.currency,
    status,
    rawResponse: input.auditPayload as Prisma.InputJsonValue,
  };

  if (order.transaction) {
    return tx.transaction.update({
      where: { id: order.transaction.id },
      data,
    });
  }
  return tx.transaction.create({
    data: { orderId: order.id, ...data },
  });
}

async function recordCallbackReview(
  input: ProcessPaymentCallbackInput,
  reason: string,
): Promise<ProcessPaymentCallbackResult> {
  return serializableWithRetry(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber: input.orderNumber },
      include: {
        transaction: true,
        user: { select: { email: true } },
      },
    });
    if (!order) {
      throw new PaymentStateError(
        "Porudžbina nije pronađena",
        "ORDER_NOT_FOUND",
        404,
      );
    }

    const existingEvent = await tx.paymentEvent.findUnique({
      where: { eventKey: input.eventKey },
    });
    if (existingEvent) {
      if (existingEvent.orderId !== order.id) {
        throw new PaymentStateError(
          "Provider događaj je već vezan za drugu porudžbinu",
          "PAYMENT_EVENT_ORDER_CONFLICT",
        );
      }
      return {
        kind:
          order.paymentStatus === "REVIEW" ||
          existingEvent.result === "REVIEW"
            ? "REVIEW"
            : "REPLAY",
        callbackOutcome: existingEvent.callbackKind,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.guestEmail || order.user?.email || "",
        guestAccess: !order.userId,
        reason: existingEvent.reason || undefined,
      };
    }

    if (
      !order.transaction ||
      !TERMINAL_TRANSACTION_STATES.has(order.transaction.status)
    ) {
      await writeTransactionSummary(tx, order, input, "REVIEW");
    }
    await tx.order.update({
      where: { id: order.id },
      data: { paymentStatus: "REVIEW" as PaymentStatus },
    });
    await tx.paymentEvent.create({
      data: {
        orderId: order.id,
        provider: input.provider,
        eventKey: input.eventKey,
        callbackKind: input.outcome,
        result: "REVIEW",
        reason,
        transId: input.transactionId || null,
        amount:
          typeof input.amount === "number" && Number.isFinite(input.amount)
            ? input.amount
            : null,
        currency: input.currency || null,
        rawResponse: input.auditPayload as Prisma.InputJsonValue,
      },
    });

    return {
      kind: "REVIEW",
      callbackOutcome: input.outcome,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.guestEmail || order.user?.email || "",
      guestAccess: !order.userId,
      reason,
    };
  });
}

export async function processPaymentCallback(
  input: ProcessPaymentCallbackInput,
): Promise<ProcessPaymentCallbackResult> {
  try {
    return await serializableWithRetry(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNumber: input.orderNumber },
      include: {
        items: true,
        transaction: true,
        user: { select: { email: true } },
      },
    });
    if (!order) {
      throw new PaymentStateError(
        "Porudžbina nije pronađena",
        "ORDER_NOT_FOUND",
        404,
      );
    }

    const existingEvent = await tx.paymentEvent.findUnique({
      where: { eventKey: input.eventKey },
    });
    if (existingEvent) {
      if (existingEvent.orderId !== order.id) {
        throw new PaymentStateError(
          "Provider događaj je već vezan za drugu porudžbinu",
          "PAYMENT_EVENT_ORDER_CONFLICT",
        );
      }

      const replayConflict =
        existingEvent.callbackKind !== input.outcome ||
        Boolean(
          existingEvent.transId &&
            input.transactionId &&
            existingEvent.transId !== input.transactionId,
        );
      if (replayConflict && order.paymentStatus !== "REVIEW") {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: "REVIEW" as PaymentStatus },
        });
      }

      if (order.paymentStatus === "REVIEW" || replayConflict) {
        return {
          kind: "REVIEW",
          callbackOutcome: input.outcome,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerEmail: order.guestEmail || order.user?.email || "",
          guestAccess: !order.userId,
          reason: replayConflict
            ? "PAYMENT_EVENT_REPLAY_CONFLICT"
            : existingEvent.reason || "PAYMENT_ALREADY_IN_REVIEW",
        };
      }

      return {
        kind: existingEvent.result === "REVIEW" ? "REVIEW" : "REPLAY",
        callbackOutcome: existingEvent.callbackKind,
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerEmail: order.guestEmail || order.user?.email || "",
        guestAccess: !order.userId,
        reason: existingEvent.reason || undefined,
      };
    }

    let forcedReviewReason: string | null = input.reviewReason || null;
    if (!forcedReviewReason && input.outcome === "APPROVED") {
      const expectedAmount = Number(order.total);
      if (
        !Number.isFinite(input.amount) ||
        Math.abs(Number(input.amount) - expectedAmount) > 0.001
      ) {
        forcedReviewReason = "CALLBACK_AMOUNT_MISMATCH";
      } else if (
        order.currency !== "RSD" ||
        !input.currency ||
        !["RSD", "941"].includes(input.currency.toUpperCase())
      ) {
        forcedReviewReason = "CALLBACK_CURRENCY_MISMATCH";
      }
    }

    const decision = forcedReviewReason
      ? { action: "REVIEW" as const, reason: forcedReviewReason }
      : input.outcome === "REVIEW"
        ? { action: "REVIEW" as const, reason: "AMBIGUOUS_PROVIDER_RESULT" }
        : decidePaymentCallback(
          {
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus as PaymentState,
            orderStatus: order.status as OrderState,
            inventoryAllocated: order.inventoryAllocated,
            hasTrackedInventory: order.items.some(
              (item) => Boolean(item.inventoryStockId),
            ),
            transactionStatus: order.transaction?.status,
            transactionId: order.transaction?.transId,
          },
          {
            outcome: input.outcome,
            transactionId: input.transactionId,
          },
        );

    let result: "APPLIED" | "REPLAY" | "REVIEW";
    let reason: string | undefined;

    if (decision.action === "APPLY_APPROVED") {
      await writeTransactionSummary(tx, order, input, "APPROVED");
      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          paymentMethod: "CARD",
          paymentStatus: order.paymentStatus,
          status: order.status,
        },
        data: {
          paymentStatus: "PAID" as PaymentStatus,
          status: "CONFIRMED" as OrderStatus,
        },
      });
      if (updated.count !== 1) {
        throw new PaymentStateError(
          "Stanje porudžbine je paralelno promenjeno",
          "PAYMENT_CALLBACK_CONFLICT",
        );
      }
      result = "APPLIED";
    } else if (decision.action === "APPLY_DECLINED") {
      await writeTransactionSummary(tx, order, input, "DECLINED");
      const updated = await tx.order.updateMany({
        where: {
          id: order.id,
          paymentMethod: "CARD",
          paymentStatus: order.paymentStatus,
          status: order.status,
        },
        data: {
          paymentStatus: "FAILED" as PaymentStatus,
          status: "CANCELLED" as OrderStatus,
        },
      });
      if (updated.count !== 1) {
        throw new PaymentStateError(
          "Stanje porudžbine je paralelno promenjeno",
          "PAYMENT_CALLBACK_CONFLICT",
        );
      }
      await releaseOrderInventoryInTransaction(tx, order.id);
      await releaseOrderCouponInTransaction(tx, order.id);
      result = "APPLIED";
    } else if (decision.action === "REPLAY") {
      result = "REPLAY";
    } else {
      reason = decision.reason;
      if (
        !order.transaction ||
        !TERMINAL_TRANSACTION_STATES.has(order.transaction.status)
      ) {
        await writeTransactionSummary(tx, order, input, "REVIEW");
      }
      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: "REVIEW" as PaymentStatus },
      });
      result = "REVIEW";
    }

    await tx.paymentEvent.create({
      data: {
        orderId: order.id,
        provider: input.provider,
        eventKey: input.eventKey,
        callbackKind: input.outcome,
        result: result === "REPLAY" ? "REPLAYED" : result,
        reason,
        transId: input.transactionId || null,
        amount:
          typeof input.amount === "number" && Number.isFinite(input.amount)
            ? input.amount
            : null,
        currency: input.currency || null,
        rawResponse: input.auditPayload as Prisma.InputJsonValue,
      },
    });

    return {
      kind: result,
      callbackOutcome: input.outcome,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerEmail: order.guestEmail || order.user?.email || "",
      guestAccess: !order.userId,
      reason,
    };
    });
  } catch (error) {
    if (
      error instanceof InventoryReleaseError ||
      error instanceof CouponReleaseError
    ) {
      return recordCallbackReview(input, error.code);
    }
    throw error;
  }
}

export async function cancelOrderAtomically(orderId: string) {
  return serializableWithRetry(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new PaymentStateError(
        "Porudžbina nije pronađena",
        "ORDER_NOT_FOUND",
        404,
      );
    }
    if (order.status === "SHIPPED") {
      throw new PaymentStateError(
        "Poslata porudžbina zahteva poseban tok povrata robe",
        "SHIPPED_ORDER_CANNOT_BE_CANCELLED",
      );
    }
    if (["PAID", "PROCESSING", "REVIEW"].includes(order.paymentStatus)) {
      throw new PaymentStateError(
        "Plaćanje mora biti razrešeno ili refundirano pre otkazivanja",
        "PAYMENT_MUST_BE_RESOLVED_BEFORE_CANCELLATION",
      );
    }

    if (order.status !== "CANCELLED") {
      const cancelled = await tx.order.updateMany({
        where: {
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
        },
        data: { status: "CANCELLED" as OrderStatus },
      });
      if (cancelled.count !== 1) {
        throw new PaymentStateError(
          "Stanje porudžbine je paralelno promenjeno",
          "ORDER_CANCELLATION_CONFLICT",
        );
      }
    }

    try {
      await releaseOrderInventoryInTransaction(tx, order.id);
      await releaseOrderCouponInTransaction(tx, order.id);
    } catch (error) {
      if (
        error instanceof InventoryReleaseError ||
        error instanceof CouponReleaseError
      ) {
        throw new PaymentStateError(error.message, error.code);
      }
      throw error;
    }
    return tx.order.findUniqueOrThrow({ where: { id: order.id } });
  });
}
