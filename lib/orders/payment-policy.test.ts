import assert from "node:assert/strict";
import test from "node:test";

import {
  decidePaymentCallback,
  decidePaymentStart,
  type PaymentCallbackState,
} from "./payment-policy";

const baseState: PaymentCallbackState = {
  paymentMethod: "CARD",
  paymentStatus: "PROCESSING",
  orderStatus: "PENDING",
  inventoryAllocated: true,
  hasTrackedInventory: true,
  transactionStatus: "INITIATED",
  transactionId: null,
};

test("fresh approved and declined callbacks apply exactly one terminal result", () => {
  assert.deepEqual(
    decidePaymentCallback(baseState, {
      outcome: "APPROVED",
      transactionId: "bank-1",
    }),
    { action: "APPLY_APPROVED" },
  );
  assert.deepEqual(
    decidePaymentCallback(baseState, {
      outcome: "DECLINED",
      transactionId: "bank-1",
    }),
    { action: "APPLY_DECLINED" },
  );
});

test("fail can never overwrite APPROVED", () => {
  assert.deepEqual(
    decidePaymentCallback(
      {
        ...baseState,
        paymentStatus: "PAID",
        orderStatus: "CONFIRMED",
        transactionStatus: "APPROVED",
        transactionId: "bank-1",
      },
      { outcome: "DECLINED", transactionId: "bank-1" },
    ),
    { action: "REVIEW", reason: "CONFLICTING_TERMINAL_CALLBACK" },
  );
});

test("late success after a decline and inventory release goes to REVIEW", () => {
  assert.deepEqual(
    decidePaymentCallback(
      {
        ...baseState,
        paymentStatus: "FAILED",
        orderStatus: "CANCELLED",
        inventoryAllocated: false,
        transactionStatus: "DECLINED",
        transactionId: "bank-1",
      },
      { outcome: "APPROVED", transactionId: "bank-1" },
    ),
    { action: "REVIEW", reason: "CONFLICTING_TERMINAL_CALLBACK" },
  );
});

test("late approval after reservation cleanup never resurrects the order", () => {
  assert.deepEqual(
    decidePaymentCallback(
      {
        ...baseState,
        paymentStatus: "FAILED",
        orderStatus: "CANCELLED",
        inventoryAllocated: false,
        transactionStatus: null,
        transactionId: null,
      },
      { outcome: "APPROVED", transactionId: "bank-late" },
    ),
    { action: "REVIEW", reason: "APPROVAL_AFTER_TERMINAL_PAYMENT" },
  );
});

test("same terminal callback is replay-safe but another transaction is not", () => {
  const approved: PaymentCallbackState = {
    ...baseState,
    paymentStatus: "PAID",
    orderStatus: "CONFIRMED",
    transactionStatus: "APPROVED",
    transactionId: "bank-1",
  };

  assert.deepEqual(
    decidePaymentCallback(approved, {
      outcome: "APPROVED",
      transactionId: "bank-1",
    }),
    { action: "REPLAY", terminal: "APPROVED" },
  );
  assert.deepEqual(
    decidePaymentCallback(approved, {
      outcome: "APPROVED",
      transactionId: "bank-2",
    }),
    { action: "REVIEW", reason: "PROVIDER_TRANSACTION_MISMATCH" },
  );
});

test("approval after cancellation or release never resurrects an order", () => {
  assert.equal(
    decidePaymentCallback(
      { ...baseState, orderStatus: "CANCELLED", inventoryAllocated: false },
      { outcome: "APPROVED", transactionId: "bank-1" },
    ).action,
    "REVIEW",
  );
  assert.equal(
    decidePaymentCallback(
      { ...baseState, inventoryAllocated: false },
      { outcome: "APPROVED", transactionId: "bank-1" },
    ).action,
    "REVIEW",
  );
});

test("payment start is a replay only for the same active attempt", () => {
  assert.deepEqual(
    decidePaymentStart({
      paymentMethod: "CARD",
      paymentStatus: "PENDING",
      orderStatus: "PENDING",
      transactionStatus: null,
    }),
    { action: "START" },
  );
  assert.deepEqual(
    decidePaymentStart({
      paymentMethod: "CARD",
      paymentStatus: "PROCESSING",
      orderStatus: "PENDING",
      transactionStatus: "INITIATED",
    }),
    { action: "REPLAY" },
  );
  assert.equal(
    decidePaymentStart({
      paymentMethod: "CARD",
      paymentStatus: "PAID",
      orderStatus: "CONFIRMED",
      transactionStatus: "APPROVED",
    }).action,
    "REJECT",
  );
});
