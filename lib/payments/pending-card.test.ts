import assert from "node:assert/strict";
import test from "node:test";

import {
  bindCheckoutAttemptToOrder,
  getCheckoutIdempotencyKeyForOrder,
} from "@/lib/checkout/idempotency";
import {
  consumeCartClearMarker,
  markCartForOrderClear,
} from "@/lib/checkout/cart-clear";
import {
  clearTerminalCardPaymentAttempt,
  readPendingCardPayment,
  savePendingCardPayment,
} from "./pending-card";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("terminalni REVIEW čisti payment i checkout attempt, ali čuva cart marker", () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage },
  });

  try {
    const orderId = "review-order";
    const attemptKey = "a".repeat(32);
    const cartItems = [{ id: "product-1", size: "M", quantity: 1 }];

    savePendingCardPayment({ orderId });
    bindCheckoutAttemptToOrder(attemptKey, orderId);
    markCartForOrderClear(orderId, cartItems);

    clearTerminalCardPaymentAttempt(orderId);

    assert.equal(readPendingCardPayment(), null);
    assert.equal(getCheckoutIdempotencyKeyForOrder(orderId), null);
    assert.equal(
      consumeCartClearMarker(orderId, cartItems),
      true,
      "terminalni cleanup ne sme ukloniti marker originalne korpe",
    );
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  }
});
