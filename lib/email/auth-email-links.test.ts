import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmailVerificationUrl,
  createPasswordResetUrl,
} from "./auth-email-links";

const TOKEN = "a".repeat(64);
const STOREFRONT = new URL("https://shop.example.com/base/ignored");

test("auth email links use the canonical origin and normalized raw token", () => {
  assert.equal(
    createEmailVerificationUrl(STOREFRONT, TOKEN.toUpperCase()),
    `https://shop.example.com/verify-email/${TOKEN}`,
  );
  assert.equal(
    createPasswordResetUrl(STOREFRONT, TOKEN),
    `https://shop.example.com/reset-password/${TOKEN}`,
  );
});

test("auth email links fail closed for malformed credentials", () => {
  for (const invalid of [
    undefined,
    null,
    "",
    "a".repeat(63),
    "a".repeat(65),
    ` ${TOKEN}`,
    `${TOKEN}?next=https://attacker.invalid`,
  ]) {
    assert.equal(createEmailVerificationUrl(STOREFRONT, invalid), null);
    assert.equal(createPasswordResetUrl(STOREFRONT, invalid), null);
  }
});
