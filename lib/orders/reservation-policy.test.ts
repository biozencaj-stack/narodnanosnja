import assert from "node:assert/strict";
import test from "node:test";

import type { OrderReservationWindows } from "../config/order-reservations";
import {
  decideInventoryReservation,
  type InventoryReservationSnapshot,
} from "./reservation-policy";

const HOUR_MS = 60 * 60 * 1000;
const NOW = new Date("2026-08-29T12:00:00.000Z");
const WINDOWS: OrderReservationWindows = {
  pendingRecoveryMs: 2 * HOUR_MS,
  processingReviewMs: 24 * HOUR_MS,
};

function ago(milliseconds: number): Date {
  return new Date(NOW.getTime() - milliseconds);
}

const pendingWithoutPaymentActivity: InventoryReservationSnapshot = {
  paymentMethod: "CARD",
  paymentStatus: "PENDING",
  orderStatus: "PENDING",
  inventoryAllocated: true,
  orderCreatedAt: ago(2 * HOUR_MS),
  transaction: null,
  paymentEventCount: 0,
  latestPaymentEventAt: null,
};

test("only untouched CARD/PENDING reservations expire at the exact cutoff", () => {
  assert.deepEqual(
    decideInventoryReservation(pendingWithoutPaymentActivity, NOW, WINDOWS),
    { action: "EXPIRE", reason: "ABANDONED_PENDING_RESERVATION" },
  );
  assert.deepEqual(
    decideInventoryReservation(
      {
        ...pendingWithoutPaymentActivity,
        orderCreatedAt: ago(2 * HOUR_MS - 1),
      },
      NOW,
      WINDOWS,
    ),
    { action: "SKIP", reason: "PENDING_RECOVERY_WINDOW_ACTIVE" },
  );
  assert.equal(
    decideInventoryReservation(
      {
        ...pendingWithoutPaymentActivity,
        orderCreatedAt: ago(2 * HOUR_MS + 1),
      },
      NOW,
      WINDOWS,
    ).action,
    "EXPIRE",
  );
});

test("cash, closed orders, unallocated inventory and terminal payments always skip", () => {
  const cases: Array<{
    name: string;
    state: InventoryReservationSnapshot;
    reason: string;
  }> = [
    {
      name: "cash",
      state: { ...pendingWithoutPaymentActivity, paymentMethod: "CASH" },
      reason: "NON_CARD_ORDER",
    },
    ...(["CONFIRMED", "SHIPPED", "CANCELLED"] as const).map(
      (orderStatus) => ({
        name: orderStatus,
        state: { ...pendingWithoutPaymentActivity, orderStatus },
        reason: "ORDER_NOT_PENDING",
      }),
    ),
    {
      name: "unallocated",
      state: {
        ...pendingWithoutPaymentActivity,
        inventoryAllocated: false,
      },
      reason: "INVENTORY_NOT_ALLOCATED",
    },
    ...(["PAID", "FAILED", "REVIEW", "REFUNDED"] as const).map(
      (paymentStatus) => ({
        name: paymentStatus,
        state: { ...pendingWithoutPaymentActivity, paymentStatus },
        reason: "PAYMENT_NOT_ACTIVE",
      }),
    ),
  ];

  for (const scenario of cases) {
    assert.deepEqual(
      decideInventoryReservation(scenario.state, NOW, WINDOWS),
      { action: "SKIP", reason: scenario.reason },
      scenario.name,
    );
  }
});

test("an active order with a terminal transaction projection goes to review", () => {
  for (const status of ["APPROVED", "DECLINED", "REVIEW"]) {
    assert.deepEqual(
      decideInventoryReservation(
        {
          ...pendingWithoutPaymentActivity,
          paymentStatus: "PROCESSING",
          orderCreatedAt: ago(48 * HOUR_MS),
          transaction: { status, createdAt: ago(48 * HOUR_MS) },
        },
        NOW,
        WINDOWS,
      ),
      {
        action: "REVIEW",
        reason: "ACTIVE_ORDER_WITH_TERMINAL_TRANSACTION",
      },
      status,
    );
  }
});

test("stale PENDING with any nonterminal transaction goes to REVIEW", () => {
  for (const status of ["INITIATED", "ERROR", "PROVIDER_PENDING"]) {
    assert.deepEqual(
      decideInventoryReservation(
        {
          ...pendingWithoutPaymentActivity,
          orderCreatedAt: ago(72 * HOUR_MS),
          transaction: { status, createdAt: ago(24 * HOUR_MS) },
        },
        NOW,
        WINDOWS,
      ),
      {
        action: "REVIEW",
        reason: "STALE_PENDING_WITH_PAYMENT_ACTIVITY",
      },
      status,
    );
  }
});

test("a recent nonterminal transaction keeps an old order inside the review window", () => {
  assert.deepEqual(
    decideInventoryReservation(
      {
        ...pendingWithoutPaymentActivity,
        orderCreatedAt: ago(72 * HOUR_MS),
        transaction: {
          status: "INITIATED",
          createdAt: ago(24 * HOUR_MS - 1),
        },
      },
      NOW,
      WINDOWS,
    ),
    { action: "SKIP", reason: "PROCESSING_REVIEW_WINDOW_ACTIVE" },
  );
});

test("PROCESSING attempts are reviewed at the exact processing cutoff and never expire", () => {
  assert.deepEqual(
    decideInventoryReservation(
      {
        ...pendingWithoutPaymentActivity,
        paymentStatus: "PROCESSING",
        orderCreatedAt: ago(72 * HOUR_MS),
        transaction: {
          status: "INITIATED",
          createdAt: ago(24 * HOUR_MS),
        },
      },
      NOW,
      WINDOWS,
    ),
    { action: "REVIEW", reason: "STALE_PROCESSING_PAYMENT" },
  );

  assert.deepEqual(
    decideInventoryReservation(
      {
        ...pendingWithoutPaymentActivity,
        paymentStatus: "PROCESSING",
        orderCreatedAt: ago(24 * HOUR_MS),
      },
      NOW,
      WINDOWS,
    ),
    {
      action: "REVIEW",
      reason: "STALE_PROCESSING_WITHOUT_TRANSACTION",
    },
  );
});

test("PROCESSING without a transaction remains protected until its review cutoff", () => {
  assert.deepEqual(
    decideInventoryReservation(
      {
        ...pendingWithoutPaymentActivity,
        paymentStatus: "PROCESSING",
        orderCreatedAt: ago(24 * HOUR_MS - 1),
      },
      NOW,
      WINDOWS,
    ),
    { action: "SKIP", reason: "PROCESSING_REVIEW_WINDOW_ACTIVE" },
  );
});

test("payment events prevent release and the newest activity extends review", () => {
  assert.deepEqual(
    decideInventoryReservation(
      {
        ...pendingWithoutPaymentActivity,
        orderCreatedAt: ago(72 * HOUR_MS),
        paymentEventCount: 1,
        latestPaymentEventAt: ago(24 * HOUR_MS),
      },
      NOW,
      WINDOWS,
    ),
    {
      action: "REVIEW",
      reason: "STALE_PENDING_WITH_PAYMENT_ACTIVITY",
    },
  );

  assert.deepEqual(
    decideInventoryReservation(
      {
        ...pendingWithoutPaymentActivity,
        orderCreatedAt: ago(72 * HOUR_MS),
        paymentEventCount: 2,
        latestPaymentEventAt: ago(HOUR_MS),
      },
      NOW,
      WINDOWS,
    ),
    { action: "SKIP", reason: "PROCESSING_REVIEW_WINDOW_ACTIVE" },
  );
});

test("invalid clocks, counters and windows fail closed", () => {
  const invalidStates: InventoryReservationSnapshot[] = [
    {
      ...pendingWithoutPaymentActivity,
      orderCreatedAt: new Date(Number.NaN),
    },
    { ...pendingWithoutPaymentActivity, paymentEventCount: -1 },
    { ...pendingWithoutPaymentActivity, paymentEventCount: 0.5 },
    {
      ...pendingWithoutPaymentActivity,
      latestPaymentEventAt: new Date(Number.NaN),
    },
    {
      ...pendingWithoutPaymentActivity,
      transaction: {
        status: "INITIATED",
        createdAt: new Date(Number.NaN),
      },
    },
  ];

  for (const state of invalidStates) {
    assert.deepEqual(decideInventoryReservation(state, NOW, WINDOWS), {
      action: "SKIP",
      reason: "INVALID_POLICY_INPUT",
    });
  }

  assert.deepEqual(
    decideInventoryReservation(
      pendingWithoutPaymentActivity,
      new Date(Number.NaN),
      WINDOWS,
    ),
    { action: "SKIP", reason: "INVALID_POLICY_INPUT" },
  );
  assert.deepEqual(
    decideInventoryReservation(pendingWithoutPaymentActivity, NOW, {
      pendingRecoveryMs: 0,
      processingReviewMs: WINDOWS.processingReviewMs,
    }),
    { action: "SKIP", reason: "INVALID_POLICY_INPUT" },
  );
});
