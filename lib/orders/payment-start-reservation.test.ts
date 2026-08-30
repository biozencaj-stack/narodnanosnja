import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";

import type { OrderReservationWindows } from "../config/order-reservations";
import {
  beginCardPaymentWithDependencies,
  PaymentStateError,
  type BeginCardPaymentDependencies,
  type StoredPaymentStartPayload,
} from "./payment";

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date("2026-08-30T00:00:00.000Z");
const WINDOWS: OrderReservationWindows = {
  pendingRecoveryMs: 2 * HOUR_MS,
  processingReviewMs: 24 * HOUR_MS,
};
const PAYLOAD: StoredPaymentStartPayload = {
  provider: "NESTPAY",
  actionUrl: "https://bank.example.test/pay",
  nonce: "test-nonce",
  fields: { oid: "order-number-1" },
};

interface TestOrder {
  id: string;
  orderNumber: string;
  total: number;
  currency: string;
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
  transaction: {
    id: string;
    status: string;
    createdAt: Date;
    rawResponse?: unknown;
  } | null;
  paymentEvents: Array<{ createdAt: Date }>;
  _count: { paymentEvents: number };
}

function order(overrides: Partial<TestOrder> = {}): TestOrder {
  return {
    id: "order-1",
    orderNumber: "order-number-1",
    total: 1_000,
    currency: "RSD",
    paymentMethod: "CARD",
    paymentStatus: "PENDING",
    status: "PENDING",
    inventoryAllocated: true,
    createdAt: new Date(NOW.getTime() - HOUR_MS),
    transaction: null,
    paymentEvents: [],
    _count: { paymentEvents: 0 },
    ...overrides,
  };
}

function createHarness(snapshot: TestOrder) {
  const orderWrites: unknown[] = [];
  const transactionWrites: unknown[] = [];
  const tx = {
    order: {
      findUnique: async () => snapshot,
      updateMany: async (args: unknown) => {
        orderWrites.push(args);
        return { count: 1 };
      },
    },
    transaction: {
      updateMany: async (args: unknown) => {
        transactionWrites.push(args);
        return { count: 1 };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const dependencies: BeginCardPaymentDependencies = {
    now: () => NOW,
    windows: WINDOWS,
    async transaction<T>(
      operation: (client: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
      return operation(tx);
    },
  };

  return { dependencies, orderWrites, transactionWrites };
}

function assertPaymentError(
  expectedCode: string,
  expectedStatus: number,
): (error: unknown) => boolean {
  return (error) => {
    assert.ok(error instanceof PaymentStateError);
    assert.equal(error.code, expectedCode);
    assert.equal(error.status, expectedStatus);
    return true;
  };
}

test("payment start rejects an expired untouched reservation before provider work", async () => {
  const harness = createHarness(
    order({ createdAt: new Date(NOW.getTime() - 3 * HOUR_MS) }),
  );
  let payloadBuilds = 0;

  await assert.rejects(
    beginCardPaymentWithDependencies(
      "order-1",
      () => {
        payloadBuilds += 1;
        return PAYLOAD;
      },
      harness.dependencies,
    ),
    assertPaymentError("PAYMENT_RESERVATION_EXPIRED", 410),
  );

  assert.equal(payloadBuilds, 0);
  assert.deepEqual(harness.orderWrites, []);
  assert.deepEqual(harness.transactionWrites, []);
});

test("payment start cannot revive an order whose inventory was released", async () => {
  const harness = createHarness(order({ inventoryAllocated: false }));

  await assert.rejects(
    beginCardPaymentWithDependencies(
      "order-1",
      () => PAYLOAD,
      harness.dependencies,
    ),
    assertPaymentError("PAYMENT_INVENTORY_NOT_RESERVED", 410),
  );

  assert.deepEqual(harness.orderWrites, []);
  assert.deepEqual(harness.transactionWrites, []);
});

test("stale provider activity is atomically projected to REVIEW", async () => {
  const harness = createHarness(
    order({
      paymentStatus: "PROCESSING",
      createdAt: new Date(NOW.getTime() - 48 * HOUR_MS),
      transaction: {
        id: "transaction-1",
        status: "INITIATED",
        createdAt: new Date(NOW.getTime() - 25 * HOUR_MS),
      },
    }),
  );
  let payloadBuilds = 0;

  const result = await beginCardPaymentWithDependencies(
    "order-1",
    () => {
      payloadBuilds += 1;
      return PAYLOAD;
    },
    harness.dependencies,
  );

  assert.deepEqual(result, {
    kind: "REVIEW",
    orderId: "order-1",
    reason: "STALE_PROCESSING_PAYMENT",
  });
  assert.equal(payloadBuilds, 0);
  assert.deepEqual(harness.transactionWrites, [
    {
      where: {
        id: "transaction-1",
        orderId: "order-1",
        status: "INITIATED",
      },
      data: { status: "REVIEW" },
    },
  ]);
  assert.deepEqual(harness.orderWrites, [
    {
      where: {
        id: "order-1",
        paymentMethod: "CARD",
        paymentStatus: "PROCESSING",
        status: "PENDING",
        inventoryAllocated: true,
      },
      data: { paymentStatus: "REVIEW" },
    },
  ]);
});
