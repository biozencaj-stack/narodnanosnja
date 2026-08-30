import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidBearerAuthorization,
  MIN_BEARER_SECRET_LENGTH,
} from "./bearer";

const SECRET = "0123456789abcdef0123456789abcdef";

test("accepts one exact Bearer authorization header", () => {
  assert.equal(SECRET.length, MIN_BEARER_SECRET_LENGTH);
  assert.equal(
    isValidBearerAuthorization(`Bearer ${SECRET}`, SECRET),
    true,
  );
});

test("supports token-safe base64 characters and trailing padding", () => {
  const secret = "abcdEFGHijklMNOPqrstUVWXyz01+/23abcd==";
  assert.equal(
    isValidBearerAuthorization(`Bearer ${secret}`, secret),
    true,
  );
});

test("fails closed when the configured secret is missing, short, or malformed", () => {
  const invalidSecrets = [
    undefined,
    null,
    "",
    "x".repeat(MIN_BEARER_SECRET_LENGTH - 1),
    ` ${SECRET}`,
    `${SECRET} `,
    `${SECRET.slice(0, 16)} ${SECRET.slice(16)}`,
    `${SECRET},duplicate`,
    `=${SECRET}`,
  ];

  for (const configuredSecret of invalidSecrets) {
    assert.equal(
      isValidBearerAuthorization(`Bearer ${SECRET}`, configuredSecret),
      false,
    );
  }
});

test("rejects wrong schemes, token prefixes, and surrounding or embedded whitespace", () => {
  const invalidHeaders = [
    undefined,
    null,
    "",
    "Bearer",
    `bearer ${SECRET}`,
    `Basic ${SECRET}`,
    ` Bearer ${SECRET}`,
    `Bearer  ${SECRET}`,
    `Bearer\t${SECRET}`,
    `Bearer ${SECRET} `,
    `Bearer ${SECRET}\t`,
    `Bearer ${SECRET}\n`,
    `Bearer ${SECRET}\r\nInjected: value`,
    `Bearer ${SECRET.slice(0, 16)} ${SECRET.slice(16)}`,
    `Bearer ${SECRET.slice(0, -1)}`,
    `Bearer ${SECRET}extra`,
  ];

  for (const authorizationHeader of invalidHeaders) {
    assert.equal(
      isValidBearerAuthorization(authorizationHeader, SECRET),
      false,
    );
  }
});

test("rejects malformed or duplicate combined Authorization values", () => {
  const combinedHeaders = [
    `Bearer ${SECRET}, Bearer ${SECRET}`,
    `Bearer ${SECRET},Bearer ${SECRET}`,
    `Bearer ${SECRET}, Basic ${SECRET}`,
    `Bearer \"${SECRET}\"`,
    `Bearer Bearer${SECRET}`,
  ];

  for (const authorizationHeader of combinedHeaders) {
    assert.equal(
      isValidBearerAuthorization(authorizationHeader, SECRET),
      false,
    );
  }
});

test("rejects a different validly shaped secret", () => {
  const wrongSecret = "fedcba9876543210fedcba9876543210";
  assert.equal(
    isValidBearerAuthorization(`Bearer ${wrongSecret}`, SECRET),
    false,
  );
});
