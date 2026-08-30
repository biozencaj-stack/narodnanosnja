import { Prisma, type PaymentStatus } from "@prisma/client";

import {
  ORDER_RESERVATION_WINDOWS,
  type OrderReservationWindows,
} from "@/lib/config/order-reservations";
import { prisma } from "@/lib/db";
import {
  CouponReleaseError,
  releaseOrderCouponInTransaction,
} from "./coupon";
import {
  InventoryReleaseError,
  releaseOrderInventoryInTransaction,
} from "./inventory";
import {
  decideInventoryReservation,
  type InventoryReservationSnapshot,
  type ReservationOrderStatus,
  type ReservationPaymentStatus,
} from "./reservation-policy";

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 200;
const SERIALIZABLE_RETRIES = 3;
const CLEANUP_CAS_CONFLICT = "RESERVATION_CLEANUP_CAS_CONFLICT";
const ACTIVE_PAYMENT_STATUSES = ["PENDING", "PROCESSING"] as const;
const TERMINAL_TRANSACTION_STATUSES = ["APPROVED", "DECLINED", "REVIEW"];

export interface OrderReservationCleanupOptions {
  dryRun?: boolean;
  now?: Date;
  batchSize?: number;
}

export interface OrderReservationCleanupSummary {
  scanned: number;
  expired: number;
  reviewed: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
}

export type OrderReservationCandidateOutcome =
  | "EXPIRED"
  | "REVIEWED"
  | "SKIPPED";

export interface OrderReservationCleanupDependencies {
  windows: OrderReservationWindows;
  findCandidateIds(
    where: Prisma.OrderWhereInput,
    batchSize: number,
  ): Promise<string[]>;
  transaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
  releaseInventory(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<boolean>;
  releaseCoupon(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void>;
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String(error.code)
    : "";
}

function normalizeBatchSize(batchSize: number | undefined): number {
  const value = batchSize ?? DEFAULT_BATCH_SIZE;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_BATCH_SIZE) {
    throw new RangeError(
      `batchSize mora biti ceo broj između 1 i ${MAX_BATCH_SIZE}`,
    );
  }
  return value;
}

function assertValidClock(now: Date, windows: OrderReservationWindows): void {
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isSafeInteger(windows.pendingRecoveryMs) ||
    windows.pendingRecoveryMs <= 0 ||
    !Number.isSafeInteger(windows.processingReviewMs) ||
    windows.processingReviewMs <= 0
  ) {
    throw new RangeError("Rok za cleanup rezervacija nije ispravan");
  }
}

/**
 * Broad DB prefilter only. The policy is always evaluated again from a fresh
 * snapshot in the per-order Serializable transaction before any write.
 */
export function buildOrderReservationCandidateWhere(
  now: Date,
  windows: OrderReservationWindows,
): Prisma.OrderWhereInput {
  assertValidClock(now, windows);
  const pendingCutoff = new Date(now.getTime() - windows.pendingRecoveryMs);
  const processingCutoff = new Date(
    now.getTime() - windows.processingReviewMs,
  );

  return {
    paymentMethod: "CARD",
    status: "PENDING",
    inventoryAllocated: true,
    paymentStatus: { in: [...ACTIVE_PAYMENT_STATUSES] },
    OR: [
      // Only a completely untouched pending card order may release stock.
      {
        paymentStatus: "PENDING",
        createdAt: { lte: pendingCutoff },
        transaction: { is: null },
        paymentEvents: { none: {} },
      },
      // PROCESSING without a transaction, and PENDING with callback evidence,
      // are review candidates. A newer event keeps them out of this batch.
      {
        createdAt: { lte: processingCutoff },
        transaction: { is: null },
        OR: [
          {
            paymentStatus: "PROCESSING",
            paymentEvents: {
              none: { createdAt: { gt: processingCutoff } },
            },
          },
          {
            paymentStatus: "PENDING",
            paymentEvents: {
              some: {},
              none: { createdAt: { gt: processingCutoff } },
            },
          },
        ],
      },
      // A terminal provider projection beside an active Order is anomalous
      // immediately. Normal callbacks update both in one transaction, so this
      // cannot expose a legitimate in-flight half-state.
      {
        transaction: {
          is: { status: { in: TERMINAL_TRANSACTION_STATUSES } },
        },
      },
      // Provider attempts use the newest order/transaction/event clock.
      // Relational filters exclude fresh nonterminal activity so it cannot
      // occupy every bounded batch only to be skipped again by the policy.
      {
        createdAt: { lte: processingCutoff },
        transaction: {
          is: {
            status: { notIn: TERMINAL_TRANSACTION_STATUSES },
            createdAt: { lte: processingCutoff },
          },
        },
        paymentEvents: {
          none: { createdAt: { gt: processingCutoff } },
        },
      },
    ],
  };
}

const productionDependencies: OrderReservationCleanupDependencies = {
  windows: ORDER_RESERVATION_WINDOWS,
  async findCandidateIds(where, batchSize) {
    const rows = await prisma.order.findMany({
      where,
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: batchSize,
    });
    return rows.map((row) => row.id);
  },
  async transaction(operation) {
    return prisma.$transaction(operation, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  },
  releaseInventory: releaseOrderInventoryInTransaction,
  releaseCoupon: releaseOrderCouponInTransaction,
};

async function serializableWithRetry<T>(
  dependencies: OrderReservationCleanupDependencies,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SERIALIZABLE_RETRIES; attempt += 1) {
    try {
      return await dependencies.transaction(operation);
    } catch (error) {
      lastError = error;
      if (
        !["P2034", CLEANUP_CAS_CONFLICT].includes(errorCode(error)) ||
        attempt === SERIALIZABLE_RETRIES
      ) {
        throw error;
      }
    }
  }
  throw lastError;
}

function cleanupCasConflict(): Error & { code: string } {
  return Object.assign(new Error(CLEANUP_CAS_CONFLICT), {
    code: CLEANUP_CAS_CONFLICT,
  });
}

async function loadReservationSnapshot(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  return tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      paymentMethod: true,
      paymentStatus: true,
      status: true,
      inventoryAllocated: true,
      createdAt: true,
      transaction: {
        select: { id: true, status: true, createdAt: true },
      },
      paymentEvents: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      _count: { select: { paymentEvents: true } },
    },
  });
}

function policySnapshot(
  order: NonNullable<Awaited<ReturnType<typeof loadReservationSnapshot>>>,
): InventoryReservationSnapshot {
  return {
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus as ReservationPaymentStatus,
    orderStatus: order.status as ReservationOrderStatus,
    inventoryAllocated: order.inventoryAllocated,
    orderCreatedAt: order.createdAt,
    transaction: order.transaction
      ? {
          status: order.transaction.status,
          createdAt: order.transaction.createdAt,
        }
      : null,
    paymentEventCount: order._count.paymentEvents,
    latestPaymentEventAt: order.paymentEvents[0]?.createdAt ?? null,
  };
}

async function expireReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
  pendingCutoff: Date,
  dependencies: OrderReservationCleanupDependencies,
): Promise<OrderReservationCandidateOutcome> {
  const claimed = await tx.order.updateMany({
    where: {
      id: orderId,
      paymentMethod: "CARD",
      paymentStatus: "PENDING",
      status: "PENDING",
      inventoryAllocated: true,
      createdAt: { lte: pendingCutoff },
      transaction: { is: null },
      paymentEvents: { none: {} },
    },
    data: {
      status: "CANCELLED",
      paymentStatus: "FAILED",
    },
  });
  if (claimed.count !== 1) return "SKIPPED";

  const released = await dependencies.releaseInventory(tx, orderId);
  if (!released) {
    throw new InventoryReleaseError(
      "Rezervacija zalihe nije mogla da bude preuzeta za povrat",
      "INVENTORY_RELEASE_NOT_CLAIMED",
    );
  }
  await dependencies.releaseCoupon(tx, orderId);
  return "EXPIRED";
}

async function reviewReservation(
  tx: Prisma.TransactionClient,
  order: NonNullable<Awaited<ReturnType<typeof loadReservationSnapshot>>>,
): Promise<OrderReservationCandidateOutcome> {
  // Payment start/callback paths also write Transaction before Order. Keeping
  // the same lock order avoids a Transaction<->Order deadlock with cleanup.
  if (
    order.transaction &&
    !TERMINAL_TRANSACTION_STATUSES.includes(order.transaction.status)
  ) {
    const transactionReviewed = await tx.transaction.updateMany({
      where: {
        id: order.transaction.id,
        orderId: order.id,
        status: order.transaction.status,
      },
      data: { status: "REVIEW" },
    });
    if (transactionReviewed.count !== 1) {
      // Retry from a fresh snapshot after a concurrent callback/start write.
      throw cleanupCasConflict();
    }
  }

  const reviewed = await tx.order.updateMany({
    where: {
      id: order.id,
      paymentMethod: "CARD",
      paymentStatus: order.paymentStatus,
      status: "PENDING",
      inventoryAllocated: true,
    },
    data: { paymentStatus: "REVIEW" as PaymentStatus },
  });
  if (reviewed.count !== 1) {
    // A preceding Transaction write, if any, must not commit on its own.
    throw cleanupCasConflict();
  }

  return "REVIEWED";
}

async function processCandidate(
  tx: Prisma.TransactionClient,
  orderId: string,
  now: Date,
  dryRun: boolean,
  dependencies: OrderReservationCleanupDependencies,
): Promise<OrderReservationCandidateOutcome> {
  const order = await loadReservationSnapshot(tx, orderId);
  if (!order) return "SKIPPED";

  const decision = decideInventoryReservation(
    policySnapshot(order),
    now,
    dependencies.windows,
  );
  if (decision.action === "SKIP") return "SKIPPED";
  if (dryRun) {
    return decision.action === "EXPIRE" ? "EXPIRED" : "REVIEWED";
  }

  if (decision.action === "EXPIRE") {
    return expireReservation(
      tx,
      order.id,
      new Date(now.getTime() - dependencies.windows.pendingRecoveryMs),
      dependencies,
    );
  }
  return reviewReservation(tx, order);
}

async function quarantinePoisonReservation(
  tx: Prisma.TransactionClient,
  orderId: string,
  now: Date,
  dependencies: OrderReservationCleanupDependencies,
): Promise<boolean> {
  const order = await loadReservationSnapshot(tx, orderId);
  if (!order) return false;
  const decision = decideInventoryReservation(
    policySnapshot(order),
    now,
    dependencies.windows,
  );
  if (decision.action !== "EXPIRE") return false;

  const reviewed = await tx.order.updateMany({
    where: {
      id: order.id,
      paymentMethod: "CARD",
      paymentStatus: "PENDING",
      status: "PENDING",
      inventoryAllocated: true,
      createdAt: {
        lte: new Date(
          now.getTime() - dependencies.windows.pendingRecoveryMs,
        ),
      },
      transaction: { is: null },
      paymentEvents: { none: {} },
    },
    data: { paymentStatus: "REVIEW" as PaymentStatus },
  });
  return reviewed.count === 1;
}

function incrementSummary(
  summary: OrderReservationCleanupSummary,
  outcome: OrderReservationCandidateOutcome,
): void {
  if (outcome === "EXPIRED") summary.expired += 1;
  else if (outcome === "REVIEWED") summary.reviewed += 1;
  else summary.skipped += 1;
}

/**
 * Exact-ID production seam for controlled DB concurrency/smoke checks. It
 * performs the same Serializable re-read and policy decision as the batch,
 * but deliberately leaves batch isolation and poison fallback to the caller.
 */
export async function processOrderReservationCandidate(
  orderId: string,
  options: Pick<OrderReservationCleanupOptions, "dryRun" | "now"> = {},
): Promise<OrderReservationCandidateOutcome> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun !== false;
  assertValidClock(now, productionDependencies.windows);
  return serializableWithRetry(productionDependencies, (tx) =>
    processCandidate(tx, orderId, now, dryRun, productionDependencies),
  );
}

/**
 * Internal dependency seam for deterministic unit tests. Public callers use
 * runOrderReservationCleanup, which is permanently wired to Prisma and the
 * existing inventory/coupon release helpers.
 */
export async function runOrderReservationCleanupWithDependencies(
  options: OrderReservationCleanupOptions,
  dependencies: OrderReservationCleanupDependencies,
): Promise<OrderReservationCleanupSummary> {
  const now = options.now ?? new Date();
  const batchSize = normalizeBatchSize(options.batchSize);
  // Applying state changes always requires an explicit opt-in. A forgotten
  // flag at any caller layer therefore remains read-only by default.
  const dryRun = options.dryRun !== false;
  assertValidClock(now, dependencies.windows);

  const candidateIds = await dependencies.findCandidateIds(
    buildOrderReservationCandidateWhere(now, dependencies.windows),
    batchSize,
  );
  const summary: OrderReservationCleanupSummary = {
    scanned: candidateIds.length,
    expired: 0,
    reviewed: 0,
    skipped: 0,
    failed: 0,
    dryRun,
  };

  for (const orderId of candidateIds) {
    try {
      const outcome = await serializableWithRetry(dependencies, (tx) =>
        processCandidate(tx, orderId, now, dryRun, dependencies),
      );
      incrementSummary(summary, outcome);
    } catch (error) {
      if (
        !dryRun &&
        (error instanceof InventoryReleaseError ||
          error instanceof CouponReleaseError)
      ) {
        try {
          const quarantined = await serializableWithRetry(
            dependencies,
            (tx) =>
              quarantinePoisonReservation(tx, orderId, now, dependencies),
          );
          if (quarantined) {
            summary.reviewed += 1;
            continue;
          }
        } catch {
          // Public result intentionally exposes only aggregate counters.
        }
      }
      summary.failed += 1;
    }
  }

  return summary;
}

export async function runOrderReservationCleanup(
  options: OrderReservationCleanupOptions = {},
): Promise<OrderReservationCleanupSummary> {
  return runOrderReservationCleanupWithDependencies(
    options,
    productionDependencies,
  );
}
