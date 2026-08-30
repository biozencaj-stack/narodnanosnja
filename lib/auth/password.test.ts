import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_BCRYPT_PASSWORD_BYTES,
  isBcryptSafePassword,
  hashPassword,
  validatePassword,
  verifyPassword,
} from "./password";

test("bcrypt input guard measures UTF-8 bytes rather than JavaScript length", () => {
  assert.equal(isBcryptSafePassword(undefined), false);
  assert.equal(isBcryptSafePassword("a".repeat(MAX_BCRYPT_PASSWORD_BYTES)), true);
  assert.equal(
    isBcryptSafePassword("a".repeat(MAX_BCRYPT_PASSWORD_BYTES + 1)),
    false,
  );
  assert.equal(isBcryptSafePassword("š".repeat(36)), true);
  assert.equal(isBcryptSafePassword("š".repeat(37)), false);
});

test("password policy remains independent from the bcrypt byte guard", () => {
  assert.deepEqual(validatePassword("DobraLozinka1!"), {
    valid: true,
    errors: [],
  });
  assert.equal(validatePassword("slaba").valid, false);
  assert.equal(validatePassword(`A1!${"x".repeat(70)}`).valid, false);
});

test("hashPassword rejects bcrypt-truncated input as defense in depth", async () => {
  await assert.rejects(
    hashPassword(`A1!${"x".repeat(70)}`),
    /bcrypt byte limit/,
  );
});

test("verifyPassword rejects a suffix beyond bcrypt's 72-byte boundary", async () => {
  const exactBoundaryPassword = `A1!${"x".repeat(
    MAX_BCRYPT_PASSWORD_BYTES - 3,
  )}`;
  const passwordHash = await hashPassword(exactBoundaryPassword);

  assert.equal(await verifyPassword(exactBoundaryPassword, passwordHash), true);
  assert.equal(
    await verifyPassword(`${exactBoundaryPassword}x`, passwordHash),
    false,
  );
});
