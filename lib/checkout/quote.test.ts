import assert from "node:assert/strict";
import test from "node:test";

import { CheckoutQuoteError, resolveCheckoutStock } from "./inventory-policy";

test("proizvod bez aktivnog stock reda je fail-closed 409", () => {
  assert.throws(
    () => resolveCheckoutStock("Test proizvod", [], "", 1),
    (error: unknown) =>
      error instanceof CheckoutQuoteError &&
      error.code === "INVENTORY_NOT_CONFIGURED" &&
      error.status === 409,
  );
});

test("checkout vraća tačan stock ID samo za dostupnu veličinu", () => {
  const sizes = [{ id: "size-m", size: "M", stock: 2 }];

  assert.equal(resolveCheckoutStock("Test proizvod", sizes, "M", 2).id, "size-m");
  assert.throws(
    () => resolveCheckoutStock("Test proizvod", sizes, "L", 1),
    (error: unknown) =>
      error instanceof CheckoutQuoteError && error.code === "OPTION_UNAVAILABLE",
  );
  assert.throws(
    () => resolveCheckoutStock("Test proizvod", sizes, "M", 3),
    (error: unknown) =>
      error instanceof CheckoutQuoteError && error.code === "INSUFFICIENT_STOCK",
  );
});
