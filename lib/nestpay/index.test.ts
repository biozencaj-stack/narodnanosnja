import assert from "node:assert/strict";
import test from "node:test";
import {
  base64Sha512,
  classifyNestPayCallback,
  createNestPayEventKey,
  getConfig,
  sanitizeNestPayCallback,
  verifyCallbackHash,
} from "./index";

const CONFIG_ENV_KEYS = [
  "NODE_ENV",
  "NEXT_PUBLIC_SITE_URL",
  "NESTPAY_CLIENT_ID",
  "NESTPAY_STORE_KEY",
  "NESTPAY_OK_URL",
  "NESTPAY_FAIL_URL",
  "NESTPAY_HPP_URL_TEST",
  "NESTPAY_CURRENCY",
  "NESTPAY_TRANTYPE",
] as const;

function withNestPayConfig(
  overrides: Partial<Record<(typeof CONFIG_ENV_KEYS)[number], string>>,
  run: () => void,
) {
  const previous = Object.fromEntries(
    CONFIG_ENV_KEYS.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, {
    NODE_ENV: "test",
    NEXT_PUBLIC_SITE_URL: "https://shop.example.com",
    NESTPAY_CLIENT_ID: "merchant",
    NESTPAY_STORE_KEY: "secret",
    NESTPAY_OK_URL:
      "https://shop.example.com/api/payments/nestpay/callback/success",
    NESTPAY_FAIL_URL:
      "https://shop.example.com/api/payments/nestpay/callback/fail",
    NESTPAY_HPP_URL_TEST: "https://bank.example.com/hpp",
    ...overrides,
  });
  try {
    run();
  } finally {
    for (const key of CONFIG_ENV_KEYS) {
      const value = previous[key];
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else Reflect.set(process.env, key, value);
    }
  }
}

test("NestPay config pins signed callbacks to the canonical HTTPS shop origin", () => {
  withNestPayConfig({}, () => {
    const config = getConfig();
    assert.equal(config.hppUrl, "https://bank.example.com/hpp");
    assert.equal(
      config.okUrl,
      "https://shop.example.com/api/payments/nestpay/callback/success",
    );
  });

  withNestPayConfig(
    {
      NESTPAY_OK_URL:
        "https://attacker.example/api/payments/nestpay/callback/success",
    },
    () => assert.throws(() => getConfig(), /NESTPAY_OK_URL/),
  );
  withNestPayConfig(
    {
      NESTPAY_FAIL_URL:
        "http://shop.example.com/api/payments/nestpay/callback/fail",
    },
    () => assert.throws(() => getConfig(), /HTTPS/),
  );
  withNestPayConfig(
    { NESTPAY_FAIL_URL: "https://shop.example.com/wrong-path" },
    () => assert.throws(() => getConfig(), /NESTPAY_FAIL_URL/),
  );
  withNestPayConfig(
    { NESTPAY_CURRENCY: "978" },
    () => assert.throws(() => getConfig(), /NESTPAY_CURRENCY/),
  );
  withNestPayConfig(
    { NESTPAY_TRANTYPE: "PreAuth" },
    () => assert.throws(() => getConfig(), /NESTPAY_TRANTYPE/),
  );
});

test("NestPay callback hash uses constant-time verification without logging secrets", () => {
  const previousSecret = process.env.NESTPAY_STORE_KEY;
  const storeKey = "bank-test-store-key";
  process.env.NESTPAY_STORE_KEY = storeKey;

  const hashParamsValue = "ORD-123|1250.00|approved";
  const params = {
    oid: "ORD-123",
    amount: "1250.00",
    Response: "approved",
    HASHPARAMS: "oid|amount|Response",
    HASHPARAMSVAL: hashParamsValue,
    HASH: base64Sha512(`${hashParamsValue}|${storeKey}`),
  };

  const originalLog = console.log;
  const messages: string[] = [];
  console.log = (...values: unknown[]) => {
    messages.push(values.map(String).join(" "));
  };

  try {
    assert.equal(verifyCallbackHash(params), true);
    assert.equal(verifyCallbackHash({ ...params, amount: "1.00" }), false);

    const output = messages.join("\n");
    assert.equal(output.includes(storeKey), false);
    assert.equal(output.includes(hashParamsValue), false);
    assert.equal(output.includes(params.HASH), false);
  } finally {
    console.log = originalLog;
    if (previousSecret === undefined) delete process.env.NESTPAY_STORE_KEY;
    else process.env.NESTPAY_STORE_KEY = previousSecret;
  }
});

test("callback classification changes state only from signed provider fields", () => {
  const approved = {
    oid: "ORD-123",
    ProcReturnCode: "00",
    Response: "Approved",
    mdStatus: "1",
    amount: "1250.00",
    currency: "941",
    TransId: "bank-1",
    AuthCode: "auth-1",
    email: "customer@example.com",
    cardNumber: "4111111111111111",
    HASHPARAMS:
      "oid|ProcReturnCode|Response|mdStatus|amount|currency|TransId|AuthCode",
    HASHPARAMSVAL: "not-persisted",
    HASH: "not-persisted",
  };

  assert.deepEqual(classifyNestPayCallback(approved), {
    outcome: "APPROVED",
    orderIdSigned: true,
    transactionId: "bank-1",
    authCode: "auth-1",
    amount: 1250,
    currency: "941",
  });

  assert.equal(
    classifyNestPayCallback({
      ...approved,
      HASHPARAMS: "ProcReturnCode|Response|mdStatus|amount|currency|TransId",
    }).reason,
    "UNSIGNED_ORDER_ID",
  );
  assert.equal(
    classifyNestPayCallback({
      ...approved,
      HASHPARAMS: "oid|ProcReturnCode|Response|mdStatus|currency|TransId",
    }).reason,
    "UNSIGNED_APPROVAL_FIELDS",
  );

  const audit = sanitizeNestPayCallback(approved);
  assert.equal(audit.oid, "ORD-123");
  assert.equal(audit.AuthCode, "auth-1");
  assert.equal("HASH" in audit, false);
  assert.equal("HASHPARAMSVAL" in audit, false);
  assert.equal("email" in audit, false);
  assert.equal("cardNumber" in audit, false);
});

test("technical or malformed result goes to review instead of implicit decline", () => {
  const base = {
    oid: "ORD-123",
    ProcReturnCode: "99",
    Response: "Error",
    mdStatus: "0",
    HASHPARAMS: "oid|ProcReturnCode|Response|mdStatus",
  };
  assert.deepEqual(classifyNestPayCallback(base), {
    outcome: "REVIEW",
    reason: "AMBIGUOUS_PROVIDER_RESULT",
    orderIdSigned: true,
    transactionId: undefined,
    authCode: undefined,
    amount: null,
    currency: null,
  });
  assert.equal(
    classifyNestPayCallback({ ...base, Response: "Declined" }).outcome,
    "DECLINED",
  );
});

test("callback event key ignores unsigned extra fields", () => {
  const signed = { HASH: "provider-signature", oid: "ORD-123" };
  assert.equal(
    createNestPayEventKey(signed),
    createNestPayEventKey({
      ...signed,
      arbitraryUnsignedField: "unbounded-replay-attempt",
    }),
  );
  assert.notEqual(
    createNestPayEventKey(signed),
    createNestPayEventKey({ ...signed, HASH: "another-signature" }),
  );
});
