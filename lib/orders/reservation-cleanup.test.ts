import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";

import type { OrderReservationWindows } from "../config/order-reservations";
import { CouponReleaseError } from "./coupon";
import { InventoryReleaseError } from "./inventory";
import {
  buildOrderReservationCandidateWhere,
  runOrderReservationCleanupWithDependencies,
  type OrderReservationCleanupDependencies,
} from "./reservation-cleanup";

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date("2026-08-29T12:00:00.000Z");
const WINDOWS: OrderReservationWindows = {
  pendingRecoveryMs: 2 * HOUR_MS,
  processingReviewMs: 24 * HOUR_MS,
};

interface TestOrder {
  id: string;
  paymentMethod: "CARD" | "CASH";
  paymentStatus:
    | "PENDING"
    | "PROCESSING"
    | "PAID"
    | "FAILED"
    | "REVIEW"
    | "REFUNDED";
  status: "PENDING" | "CONFIRMED" | "SHIPPED" | "CANCELLED";
  inventoryAllocated: boolean;
  createdAt: Date;
  transaction: { id: string; status: string; createdAt: Date } | null;
  paymentEvents: Array<{ createdAt: Date }>;
  _count: { paymentEvents: number };
}

function oldPending(id: string): TestOrder {
  return {
    id,
    paymentMethod: "CARD",
    paymentStatus: "PENDING",
    status: "PENDING",
    inventoryAllocated: true,
    createdAt: new Date(NOW.getTime() - 3 * HOUR_MS),
    transaction: null,
    paymentEvents: [],
    _count: { paymentEvents: 0 },
  };
}

function staleProcessing(id: string): TestOrder {
  return {
    ...oldPending(id),
    paymentStatus: "PROCESSING",
    createdAt: new Date(NOW.getTime() - 48 * HOUR_MS),
    transaction: {
      id: `transaction-${id}`,
      status: "INITIATED",
      createdAt: new Date(NOW.getTime() - 25 * HOUR_MS),
    },
  };
}

interface HarnessOptions {
  ids: string[];
  orders: Record<string, TestOrder | Error | null>;
  orderCas?: (args: unknown, call: number) => number;
  transactionCas?: (args: unknown, call: number) => number;
  transactionWrapper?: OrderReservationCleanupDependencies["transaction"];
  releaseInventory?: OrderReservationCleanupDependencies["releaseInventory"];
  releaseCoupon?: OrderReservationCleanupDependencies["releaseCoupon"];
}

function createHarness(options: HarnessOptions) {
  const orderWrites: unknown[] = [];
  const transactionWrites: unknown[] = [];
  const inventoryReleases: string[] = [];
  const couponReleases: string[] = [];
  const candidateQueries: Array<{
    where: Prisma.OrderWhereInput;
    batchSize: number;
  }> = [];
  let orderCasCalls = 0;
  let transactionCasCalls = 0;

  const tx = {
    order: {
      findUnique: async (args: { where: { id: string } }) => {
        const order = options.orders[args.where.id];
        if (order instanceof Error) throw order;
        return order ?? null;
      },
      updateMany: async (args: unknown) => {
        orderWrites.push(args);
        orderCasCalls += 1;
        return {
          count: options.orderCas
            ? options.orderCas(args, orderCasCalls)
            : 1,
        };
      },
    },
    transaction: {
      updateMany: async (args: unknown) => {
        transactionWrites.push(args);
        transactionCasCalls += 1;
        return {
          count: options.transactionCas
            ? options.transactionCas(args, transactionCasCalls)
            : 1,
        };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const defaultTransaction: OrderReservationCleanupDependencies["transaction"] =
    async <T>(operation: (client: Prisma.TransactionClient) => Promise<T>) =>
      operation(tx);

  const dependencies: OrderReservationCleanupDependencies = {
    windows: WINDOWS,
    findCandidateIds: async (where, batchSize) => {
      candidateQueries.push({ where, batchSize });
      return options.ids;
    },
    transaction: options.transactionWrapper ?? defaultTransaction,
    releaseInventory:
      options.releaseInventory ??
      (async (_tx, orderId) => {
        inventoryReleases.push(orderId);
        return true;
      }),
    releaseCoupon:
      options.releaseCoupon ??
      (async (_tx, orderId) => {
        couponReleases.push(orderId);
      }),
  };

  return {
    dependencies,
    tx,
    orderWrites,
    transactionWrites,
    inventoryReleases,
    couponReleases,
    candidateQueries,
  };
}

test("candidate query excludes fresh related payment activity from the bounded batch", () => {
  const pendingCutoff = new Date(NOW.getTime() - 2 * HOUR_MS);
  const processingCutoff = new Date(NOW.getTime() - 24 * HOUR_MS);

  assert.deepEqual(buildOrderReservationCandidateWhere(NOW, WINDOWS), {
    paymentMethod: "CARD",
    status: "PENDING",
    inventoryAllocated: true,
    paymentStatus: { in: ["PENDING", "PROCESSING"] },
    OR: [
      {
        paymentStatus: "PENDING",
        createdAt: { lte: pendingCutoff },
        transaction: { is: null },
        paymentEvents: { none: {} },
      },
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
      {
        transaction: {
          is: { status: { in: ["APPROVED", "DECLINED", "REVIEW"] } },
        },
      },
      {
        createdAt: { lte: processingCutoff },
        transaction: {
          is: {
            status: { notIn: ["APPROVED", "DECLINED", "REVIEW"] },
            createdAt: { lte: processingCutoff },
          },
        },
        paymentEvents: {
          none: { createdAt: { gt: processingCutoff } },
        },
      },
    ],
  });
});

test("dry-run reports projected decisions without writes or release calls", async () => {
  const harness = createHarness({
    ids: ["expire", "review"],
    orders: {
      expire: oldPending("expire"),
      review: staleProcessing("review"),
    },
  });

  const result = await runOrderReservationCleanupWithDependencies(
    { dryRun: true, now: NOW, batchSize: 2 },
    harness.dependencies,
  );

  assert.deepEqual(result, {
    scanned: 2,
    expired: 1,
    reviewed: 1,
    skipped: 0,
    failed: 0,
    dryRun: true,
  });
  assert.equal(harness.orderWrites.length, 0);
  assert.equal(harness.transactionWrites.length, 0);
  assert.deepEqual(harness.inventoryReleases, []);
  assert.deepEqual(harness.couponReleases, []);
});

test("expiry uses a strict CAS and releases inventory and coupon exactly once", async () => {
  const harness = createHarness({
    ids: ["expire", "lost-race"],
    orders: {
      expire: oldPending("expire"),
      "lost-race": oldPending("lost-race"),
    },
    orderCas: (_args, call) => (call === 1 ? 1 : 0),
  });

  const result = await runOrderReservationCleanupWithDependencies(
    { now: NOW, dryRun: false },
    harness.dependencies,
  );

  assert.deepEqual(result, {
    scanned: 2,
    expired: 1,
    reviewed: 0,
    skipped: 1,
    failed: 0,
    dryRun: false,
  });
  assert.deepEqual(harness.inventoryReleases, ["expire"]);
  assert.deepEqual(harness.couponReleases, ["expire"]);
  assert.deepEqual(harness.orderWrites[0], {
    where: {
      id: "expire",
      paymentMethod: "CARD",
      paymentStatus: "PENDING",
      status: "PENDING",
      inventoryAllocated: true,
      createdAt: { lte: new Date(NOW.getTime() - 2 * HOUR_MS) },
      transaction: { is: null },
      paymentEvents: { none: {} },
    },
    data: { status: "CANCELLED", paymentStatus: "FAILED" },
  });
});

test("review keeps allocation and order status while marking a live transaction", async () => {
  const harness = createHarness({
    ids: ["review"],
    orders: { review: staleProcessing("review") },
  });

  const result = await runOrderReservationCleanupWithDependencies(
    { now: NOW, dryRun: false },
    harness.dependencies,
  );

  assert.equal(result.reviewed, 1);
  assert.deepEqual(harness.orderWrites, [
    {
      where: {
        id: "review",
        paymentMethod: "CARD",
        paymentStatus: "PROCESSING",
        status: "PENDING",
        inventoryAllocated: true,
      },
      data: { paymentStatus: "REVIEW" },
    },
  ]);
  assert.deepEqual(harness.transactionWrites, [
    {
      where: {
        id: "transaction-review",
        orderId: "review",
        status: "INITIATED",
      },
      data: { status: "REVIEW" },
    },
  ]);
  assert.deepEqual(harness.inventoryReleases, []);
  assert.deepEqual(harness.couponReleases, []);
});

test("terminal transaction anomaly reviews only the Order projection", async () => {
  const terminal = staleProcessing("terminal");
  terminal.transaction = {
    id: "transaction-terminal",
    status: "APPROVED",
    createdAt: new Date(NOW.getTime() - 1),
  };
  terminal.createdAt = new Date(NOW.getTime() - 1);
  const harness = createHarness({
    ids: ["terminal"],
    orders: { terminal },
  });

  const result = await runOrderReservationCleanupWithDependencies(
    { now: NOW, dryRun: false },
    harness.dependencies,
  );

  assert.equal(result.reviewed, 1);
  assert.deepEqual(harness.orderWrites, [
    {
      where: {
        id: "terminal",
        paymentMethod: "CARD",
        paymentStatus: "PROCESSING",
        status: "PENDING",
        inventoryAllocated: true,
      },
      data: { paymentStatus: "REVIEW" },
    },
  ]);
  assert.deepEqual(harness.transactionWrites, []);
  assert.deepEqual(harness.inventoryReleases, []);
});

test("one order failure is isolated and does not stop the remaining batch", async () => {
  const harness = createHarness({
    ids: ["broken", "healthy"],
    orders: {
      broken: new Error("fixture failure with private details"),
      healthy: oldPending("healthy"),
    },
  });

  const result = await runOrderReservationCleanupWithDependencies(
    { now: NOW, dryRun: false },
    harness.dependencies,
  );

  assert.deepEqual(result, {
    scanned: 2,
    expired: 1,
    reviewed: 0,
    skipped: 0,
    failed: 1,
    dryRun: false,
  });
  assert.deepEqual(Object.keys(result).sort(), [
    "dryRun",
    "expired",
    "failed",
    "reviewed",
    "scanned",
    "skipped",
  ]);
  assert.deepEqual(harness.inventoryReleases, ["healthy"]);
});

test("inventory release poison order is quarantined in REVIEW without release", async () => {
  const releaseAttempts: string[] = [];
  const harness = createHarness({
    ids: ["poison"],
    orders: { poison: oldPending("poison") },
    releaseInventory: async (_tx, orderId) => {
      releaseAttempts.push(orderId);
      throw new InventoryReleaseError("snapshot missing");
    },
  });

  const result = await runOrderReservationCleanupWithDependencies(
    { now: NOW, dryRun: false },
    harness.dependencies,
  );

  assert.deepEqual(result, {
    scanned: 1,
    expired: 0,
    reviewed: 1,
    skipped: 0,
    failed: 0,
    dryRun: false,
  });
  assert.deepEqual(releaseAttempts, ["poison"]);
  assert.deepEqual(harness.couponReleases, []);
  assert.deepEqual(harness.orderWrites.at(-1), {
    where: {
      id: "poison",
      paymentMethod: "CARD",
      paymentStatus: "PENDING",
      status: "PENDING",
      inventoryAllocated: true,
      createdAt: { lte: new Date(NOW.getTime() - 2 * HOUR_MS) },
      transaction: { is: null },
      paymentEvents: { none: {} },
    },
    data: { paymentStatus: "REVIEW" },
  });
});

test("a false inventory release claim rolls back expiry and uses REVIEW fallback", async () => {
  const couponAttempts: string[] = [];
  const harness = createHarness({
    ids: ["unclaimed"],
    orders: { unclaimed: oldPending("unclaimed") },
    releaseInventory: async () => false,
    releaseCoupon: async (_tx, orderId) => {
      couponAttempts.push(orderId);
    },
  });

  const result = await runOrderReservationCleanupWithDependencies(
    { now: NOW, dryRun: false },
    harness.dependencies,
  );

  assert.deepEqual(result, {
    scanned: 1,
    expired: 0,
    reviewed: 1,
    skipped: 0,
    failed: 0,
    dryRun: false,
  });
  assert.deepEqual(couponAttempts, []);
  assert.deepEqual(harness.orderWrites.at(-1), {
    where: {
      id: "unclaimed",
      paymentMethod: "CARD",
      paymentStatus: "PENDING",
      status: "PENDING",
      inventoryAllocated: true,
      createdAt: { lte: new Date(NOW.getTime() - 2 * HOUR_MS) },
      transaction: { is: null },
      paymentEvents: { none: {} },
    },
    data: { paymentStatus: "REVIEW" },
  });
});

test("coupon release poison uses the same safe fallback and fallback CAS can fail", async () => {
  const successfulFallback = createHarness({
    ids: ["coupon-poison"],
    orders: { "coupon-poison": oldPending("coupon-poison") },
    releaseCoupon: async () => {
      throw new CouponReleaseError("count mismatch", "COUPON_CONFLICT");
    },
  });
  const reviewed = await runOrderReservationCleanupWithDependencies(
    { now: NOW, dryRun: false },
    successfulFallback.dependencies,
  );
  assert.equal(reviewed.reviewed, 1);
  assert.equal(reviewed.failed, 0);

  const failedFallback = createHarness({
    ids: ["coupon-poison"],
    orders: { "coupon-poison": oldPending("coupon-poison") },
    orderCas: (_args, call) => (call === 1 ? 1 : 0),
    releaseCoupon: async () => {
      throw new CouponReleaseError("count mismatch", "COUPON_CONFLICT");
    },
  });
  const failed = await runOrderReservationCleanupWithDependencies(
    { now: NOW, dryRun: false },
    failedFallback.dependencies,
  );
  assert.equal(failed.reviewed, 0);
  assert.equal(failed.failed, 1);
});

test("P2034 retries the individual Serializable transaction", async () => {
  let attempts = 0;
  const transactionWrapper: OrderReservationCleanupDependencies["transaction"] =
    async <T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) => {
      attempts += 1;
      if (attempts === 1) {
        throw Object.assign(new Error("serialization conflict"), {
          code: "P2034",
        });
      }
      return operation(harness.tx);
    };
  const harness = createHarness({
    ids: ["retry"],
    orders: { retry: oldPending("retry") },
    transactionWrapper,
  });

  const result = await runOrderReservationCleanupWithDependencies(
    { now: NOW, dryRun: false },
    harness.dependencies,
  );

  assert.equal(attempts, 2);
  assert.equal(result.expired, 1);
  assert.equal(result.failed, 0);
});

test("review CAS conflict retries before a partial projection can commit", async () => {
  const harness = createHarness({
    ids: ["review-retry"],
    orders: { "review-retry": staleProcessing("review-retry") },
    transactionCas: (_args, call) => (call === 1 ? 0 : 1),
  });

  const result = await runOrderReservationCleanupWithDependencies(
    { now: NOW, dryRun: false },
    harness.dependencies,
  );

  assert.equal(harness.transactionWrites.length, 2);
  assert.equal(harness.orderWrites.length, 1);
  assert.equal(result.reviewed, 1);
  assert.equal(result.failed, 0);
});

test("batch defaults to fifty and cleanup defaults to dry-run", async () => {
  const harness = createHarness({ ids: [], orders: {} });
  const result = await runOrderReservationCleanupWithDependencies(
    { now: NOW },
    harness.dependencies,
  );
  assert.equal(harness.candidateQueries[0].batchSize, 50);
  assert.equal(result.dryRun, true);

  for (const batchSize of [0, 201, 1.5, Number.NaN]) {
    await assert.rejects(
      runOrderReservationCleanupWithDependencies(
        { now: NOW, batchSize },
        harness.dependencies,
      ),
      RangeError,
    );
  }
});
