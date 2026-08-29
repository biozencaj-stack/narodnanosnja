import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrderAccessCookieValue,
  createOrderAccessToken,
  createPaymentHandoffToken,
  getOrderAccessTokenFromCookie,
  orderAccessCookieName,
  verifyPaymentHandoffToken,
  verifyOrderAccessToken,
} from "./access";

test("order access token is scoped, signed and expires", () => {
  const previous = process.env.ORDER_ACCESS_SECRET;
  process.env.ORDER_ACCESS_SECRET = "test-secret-with-enough-entropy";

  try {
    const orderId = "order_123";
    const token = createOrderAccessToken(orderId, 60);

    assert.equal(verifyOrderAccessToken(orderId, token), true);
    assert.equal(verifyOrderAccessToken("order_456", token), false);
    assert.equal(verifyOrderAccessToken(orderId, `${token}tampered`), false);
    assert.equal(verifyOrderAccessToken(orderId, createOrderAccessToken(orderId, -1)), false);

    const cookie = createOrderAccessCookieValue(orderId, token);
    assert.equal(getOrderAccessTokenFromCookie(orderId, cookie), token);
    assert.equal(getOrderAccessTokenFromCookie("order_456", cookie), null);

    assert.notEqual(
      orderAccessCookieName(orderId),
      orderAccessCookieName("order_456"),
    );

    const legacyCookie = `${orderId}:${token}`;
    assert.equal(getOrderAccessTokenFromCookie(orderId, legacyCookie), token);

    const handoff = createPaymentHandoffToken(orderId, 60);
    assert.equal(verifyPaymentHandoffToken(orderId, handoff), true);
    assert.equal(verifyPaymentHandoffToken("order_456", handoff), false);
    assert.equal(verifyOrderAccessToken(orderId, handoff), false);
  } finally {
    if (previous === undefined) delete process.env.ORDER_ACCESS_SECRET;
    else process.env.ORDER_ACCESS_SECRET = previous;
  }
});
