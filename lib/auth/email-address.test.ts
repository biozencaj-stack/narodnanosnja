import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_EMAIL_ADDRESS_LENGTH,
  MAX_EMAIL_LOCAL_PART_LENGTH,
  normalizeEmailAddress,
} from "./email-address";

test("email normalization is strict, bounded and canonical", () => {
  assert.equal(normalizeEmailAddress(undefined), null);
  assert.equal(normalizeEmailAddress(null), null);
  assert.equal(normalizeEmailAddress({}), null);
  assert.equal(normalizeEmailAddress(""), null);
  assert.equal(normalizeEmailAddress("nema-at-znak.example.com"), null);
  assert.equal(normalizeEmailAddress("kupac @example.com"), null);
  assert.equal(normalizeEmailAddress("kupac@example"), null);
  assert.equal(normalizeEmailAddress("a".repeat(MAX_EMAIL_ADDRESS_LENGTH + 1)), null);
  assert.equal(
    normalizeEmailAddress(
      `${"a".repeat(MAX_EMAIL_LOCAL_PART_LENGTH + 1)}@example.com`,
    ),
    null,
  );
  assert.equal(
    normalizeEmailAddress("  KUPAC@EXAMPLE.COM  "),
    "kupac@example.com",
  );
  assert.equal(
    normalizeEmailAddress("Ime.Prezime+prodavnica@Sub.Example.COM"),
    "ime.prezime+prodavnica@sub.example.com",
  );
});

test("email normalization rejects Nodemailer address expressions", () => {
  for (const value of [
    "(napomena)kupac@example.com",
    "kupac@example.com (napomena)",
    "Ime <kupac@example.com>",
    "group:kupac@example.com;",
    "kupac@example.com,drugi@example.com",
    "kupac@example.com:drugi@example.com",
    "kupac[oznaka]@example.com",
    '"kupac"@example.com',
  ]) {
    assert.equal(normalizeEmailAddress(value), null, value);
  }
});
