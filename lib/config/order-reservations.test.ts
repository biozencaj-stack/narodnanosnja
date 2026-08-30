import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ORDER_PROCESSING_REVIEW_MINUTES,
  MAX_ORDER_PROCESSING_REVIEW_MINUTES,
  MIN_ORDER_PROCESSING_REVIEW_MINUTES,
  ORDER_PENDING_RECOVERY_WINDOW_MS,
  ORDER_PROCESSING_REVIEW_MINUTES_ENV,
  parseOrderProcessingReviewMs,
  resolveOrderReservationWindows,
} from "./order-reservations";

const MINUTE_MS = 60 * 1000;

test("pending checkout and idempotency recovery share the fixed two-hour window", () => {
  assert.equal(ORDER_PENDING_RECOVERY_WINDOW_MS, 2 * 60 * MINUTE_MS);
  assert.deepEqual(resolveOrderReservationWindows({}), {
    pendingRecoveryMs: 2 * 60 * MINUTE_MS,
    processingReviewMs:
      DEFAULT_ORDER_PROCESSING_REVIEW_MINUTES * MINUTE_MS,
  });
});

test("processing review configuration accepts both inclusive bounds", () => {
  assert.equal(
    parseOrderProcessingReviewMs(
      String(MIN_ORDER_PROCESSING_REVIEW_MINUTES),
    ),
    MIN_ORDER_PROCESSING_REVIEW_MINUTES * MINUTE_MS,
  );
  assert.equal(
    parseOrderProcessingReviewMs(
      String(MAX_ORDER_PROCESSING_REVIEW_MINUTES),
    ),
    MAX_ORDER_PROCESSING_REVIEW_MINUTES * MINUTE_MS,
  );
});

test("missing processing configuration uses a conservative 24-hour default", () => {
  assert.equal(
    parseOrderProcessingReviewMs(undefined),
    24 * 60 * MINUTE_MS,
  );
});

test("environment resolver reads only the bounded processing duration", () => {
  assert.deepEqual(
    resolveOrderReservationWindows({
      [ORDER_PROCESSING_REVIEW_MINUTES_ENV]: "360",
      UNRELATED_VALUE: "1",
    }),
    {
      pendingRecoveryMs: ORDER_PENDING_RECOVERY_WINDOW_MS,
      processingReviewMs: 360 * MINUTE_MS,
    },
  );
});

test("present but ambiguous processing durations fail closed", () => {
  for (const value of [
    "",
    " 120",
    "120 ",
    "+120",
    "0120",
    "120.0",
    "1e3",
    "120m",
    "-120",
  ]) {
    assert.throws(
      () => parseOrderProcessingReviewMs(value),
      new RegExp(ORDER_PROCESSING_REVIEW_MINUTES_ENV),
      value,
    );
  }
});

test("processing duration rejects values outside the safe bounds", () => {
  for (const minutes of [
    MIN_ORDER_PROCESSING_REVIEW_MINUTES - 1,
    MAX_ORDER_PROCESSING_REVIEW_MINUTES + 1,
    Number.MAX_SAFE_INTEGER,
  ]) {
    assert.throws(
      () => parseOrderProcessingReviewMs(String(minutes)),
      /ceo broj minuta/,
      String(minutes),
    );
  }
});
