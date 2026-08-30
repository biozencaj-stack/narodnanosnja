import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";
import { createCredentialTokenLookupKeys } from "./credential-token";
import { PasswordResetConfirmConflictError } from "./password-reset-confirm";
import {
  MAX_BCRYPT_PASSWORD_BYTES,
  PASSWORD_RESET_CONFIRM_INVALID_MESSAGE,
  PASSWORD_RESET_CONFIRM_RETRY_MESSAGE,
  PASSWORD_RESET_CONFIRM_SUCCESS_MESSAGE,
  createPasswordResetConfirmHandler,
  type PasswordResetConfirmFailure,
  type PasswordResetConfirmHandlerDependencies,
  type PasswordResetConfirmRecord,
} from "./password-reset-confirm-route";

const ENDPOINT =
  "https://shop.example.test/api/auth/reset-password/confirm";
const TOKEN = "a".repeat(64);
const PASSWORD = "NovaLozinka1!";
const RESET_AT = new Date("2026-08-30T12:00:00.000Z");
const lookupKeys = createCredentialTokenLookupKeys("password-reset", TOKEN);
if (!lookupKeys) throw new Error("Test token must produce lookup keys");
const LOOKUP_KEYS = lookupKeys;

function request(
  body: unknown,
  headers: Record<string, string> = {
    host: "shop.example.test",
    origin: "https://shop.example.test",
  },
): NextRequest {
  return new NextRequest(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function currentRecord(
  overrides: Partial<PasswordResetConfirmRecord> = {},
): PasswordResetConfirmRecord {
  return {
    id: "reset-id",
    userId: "user-id",
    token: null,
    tokenHash: LOOKUP_KEYS.currentHash,
    expires: new Date(RESET_AT.getTime() + 60_000),
    ...overrides,
  };
}

function legacyRecord(
  overrides: Partial<PasswordResetConfirmRecord> = {},
): PasswordResetConfirmRecord {
  return currentRecord({
    token: LOOKUP_KEYS.legacyPlaintext,
    tokenHash: null,
    ...overrides,
  });
}

function createHarness(
  overrides: Partial<PasswordResetConfirmHandlerDependencies> = {},
) {
  const events: string[] = [];
  const failures: PasswordResetConfirmFailure[] = [];
  const commits: Parameters<
    PasswordResetConfirmHandlerDependencies["commitReset"]
  >[] = [];
  const dependencies: PasswordResetConfirmHandlerDependencies = {
    checkRateLimit() {
      events.push("rate-limit");
      return true;
    },
    validatePassword() {
      events.push("password-validation");
      return { valid: true, errors: [] };
    },
    createLookupKeys(submittedToken) {
      events.push("token-keys");
      return createCredentialTokenLookupKeys(
        "password-reset",
        submittedToken,
      );
    },
    async findByCurrentHash() {
      events.push("hash-lookup");
      return currentRecord();
    },
    async findByLegacyToken() {
      events.push("legacy-lookup");
      return null;
    },
    async hashPassword() {
      events.push("password-hash");
      return "prepared-bcrypt-hash";
    },
    prepareSuccessResponse() {
      events.push("response-preparation");
      return NextResponse.json({
        message: PASSWORD_RESET_CONFIRM_SUCCESS_MESSAGE,
      });
    },
    async commitReset(...input) {
      events.push("commit");
      commits.push(input);
    },
    reportFailure(failure) {
      failures.push(failure);
    },
    now: () => RESET_AT,
    ...overrides,
  };
  return {
    handler: createPasswordResetConfirmHandler(dependencies),
    dependencies,
    events,
    failures,
    commits,
  };
}

function assertPrivate(response: NextResponse): void {
  assert.equal(
    response.headers.get("cache-control"),
    "private, no-store, max-age=0",
  );
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(
    response.headers.get("x-robots-tag"),
    "noindex, nofollow, noarchive",
  );
}

test("same-origin guard runs before rate limit, body, token config and database", async () => {
  const harness = createHarness({
    checkRateLimit() {
      throw new Error("must not run");
    },
    createLookupKeys() {
      throw new Error("must not run");
    },
    async findByCurrentHash() {
      throw new Error("must not run");
    },
  });

  const response = await harness.handler(
    request("{", {
      host: "shop.example.test",
      origin: "https://attacker.example",
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(harness.events, []);
  assert.deepEqual(harness.failures, []);
  assertPrivate(response);
});

test("malformed input and overlong bcrypt values stop before lookup", async () => {
  const malformedJson = createHarness();
  const malformedResponse = await malformedJson.handler(request("{"));
  assert.equal(malformedResponse.status, 400);
  assert.deepEqual(malformedJson.events, ["rate-limit"]);

  const invalidBodies = [
    { token: TOKEN.slice(1), password: PASSWORD },
    { token: ` ${TOKEN}`, password: PASSWORD },
    { token: { value: TOKEN }, password: PASSWORD },
    { token: TOKEN, password: null },
    {
      token: TOKEN,
      password: `A1!${"x".repeat(MAX_BCRYPT_PASSWORD_BYTES)}`,
    },
  ];
  for (const body of invalidBodies) {
    const harness = createHarness();
    const response = await harness.handler(request(body));
    assert.equal(response.status, 400);
    assert.deepEqual(harness.events, ["rate-limit"]);
    assertPrivate(response);
  }
});

test("password policy errors are public validation only and do not derive token keys", async () => {
  const harness = createHarness({
    validatePassword() {
      harness.events.push("password-validation");
      return {
        valid: false,
        errors: ["Lozinka mora sadržati bar jedno veliko slovo"],
      };
    },
  });

  const response = await harness.handler(
    request({ token: TOKEN, password: "slabal1!" }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Lozinka mora sadržati bar jedno veliko slovo",
  });
  assert.deepEqual(harness.events, ["rate-limit", "password-validation"]);
  assertPrivate(response);
});

test("current hash lookup is first and success is fully prepared before commit", async () => {
  const harness = createHarness();
  const response = await harness.handler(
    request({ token: TOKEN.toUpperCase(), password: PASSWORD }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    message: PASSWORD_RESET_CONFIRM_SUCCESS_MESSAGE,
  });
  assert.deepEqual(harness.events, [
    "rate-limit",
    "password-validation",
    "token-keys",
    "hash-lookup",
    "password-hash",
    "response-preparation",
    "commit",
  ]);
  assert.equal(harness.commits.length, 1);
  assert.deepEqual(harness.commits[0], [
    {
      id: "reset-id",
      userId: "user-id",
      credential: {
        kind: "current-hash",
        storedValue: LOOKUP_KEYS.currentHash,
      },
    },
    "prepared-bcrypt-hash",
    RESET_AT,
  ]);
  assertPrivate(response);
});

test("legacy plaintext lookup runs only after a current-hash miss", async () => {
  const harness = createHarness({
    async findByCurrentHash() {
      harness.events.push("hash-lookup");
      return null;
    },
    async findByLegacyToken() {
      harness.events.push("legacy-lookup");
      return legacyRecord();
    },
  });

  const response = await harness.handler(
    request({ token: TOKEN, password: PASSWORD }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(harness.events, [
    "rate-limit",
    "password-validation",
    "token-keys",
    "hash-lookup",
    "legacy-lookup",
    "password-hash",
    "response-preparation",
    "commit",
  ]);
  assert.deepEqual(harness.commits[0]?.[0], {
    id: "reset-id",
    userId: "user-id",
    credential: {
      kind: "legacy-plaintext",
      storedValue: LOOKUP_KEYS.legacyPlaintext,
    },
  });
});

test("a row with a current hash can never downgrade to plaintext fallback", async () => {
  const harness = createHarness({
    async findByCurrentHash() {
      return null;
    },
    async findByLegacyToken() {
      return legacyRecord({ tokenHash: `v1:${"c".repeat(64)}` });
    },
  });

  const response = await harness.handler(
    request({ token: TOKEN, password: PASSWORD }),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: PASSWORD_RESET_CONFIRM_RETRY_MESSAGE,
  });
  assert.deepEqual(harness.failures, [{ stage: "LEGACY_LOOKUP" }]);
  assert.equal(harness.commits.length, 0);
  assertPrivate(response);
});

test("missing, expired and exact-boundary credentials share one generic response", async () => {
  const scenarios: Array<{
    name: string;
    overrides: Partial<PasswordResetConfirmHandlerDependencies>;
  }> = [
    {
      name: "missing",
      overrides: {
        async findByCurrentHash() {
          return null;
        },
        async findByLegacyToken() {
          return null;
        },
      },
    },
    {
      name: "expired",
      overrides: {
        async findByCurrentHash() {
          return currentRecord({
            expires: new Date(RESET_AT.getTime() - 1),
          });
        },
      },
    },
    {
      name: "boundary",
      overrides: {
        async findByCurrentHash() {
          return currentRecord({ expires: RESET_AT });
        },
      },
    },
  ];

  for (const scenario of scenarios) {
    const harness = createHarness(scenario.overrides);
    const response = await harness.handler(
      request({ token: TOKEN, password: PASSWORD }),
    );
    assert.equal(response.status, 400, scenario.name);
    assert.deepEqual(await response.json(), {
      error: PASSWORD_RESET_CONFIRM_INVALID_MESSAGE,
    });
    assert.equal(harness.commits.length, 0);
    assertPrivate(response);
  }
});

test("a credential expiring during bcrypt or response preparation is never committed", async () => {
  let clockReads = 0;
  const harness = createHarness({
    async findByCurrentHash() {
      harness.events.push("hash-lookup");
      return currentRecord({
        expires: new Date(RESET_AT.getTime() + 30_000),
      });
    },
    now() {
      clockReads += 1;
      return clockReads === 1
        ? RESET_AT
        : new Date(RESET_AT.getTime() + 30_000);
    },
  });

  const response = await harness.handler(
    request({ token: TOKEN, password: PASSWORD }),
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: PASSWORD_RESET_CONFIRM_INVALID_MESSAGE,
  });
  assert.deepEqual(harness.events, [
    "rate-limit",
    "password-validation",
    "token-keys",
    "hash-lookup",
    "password-hash",
    "response-preparation",
  ]);
  assert.equal(clockReads, 2);
  assert.equal(harness.commits.length, 0);
  assertPrivate(response);
});

test("claim conflicts discard prepared success and become generic invalid responses", async () => {
  const harness = createHarness({
    async commitReset() {
      harness.events.push("commit");
      throw new PasswordResetConfirmConflictError();
    },
  });

  const response = await harness.handler(
    request({ token: TOKEN, password: PASSWORD }),
  );

  assert.equal(response.status, 400);
  const responseBody = await response.json();
  assert.deepEqual(responseBody, {
    error: PASSWORD_RESET_CONFIRM_INVALID_MESSAGE,
  });
  assert.deepEqual(harness.failures, [{ stage: "COMMIT" }]);
  assert.equal(JSON.stringify(responseBody).includes("uspešno"), false);
  assertPrivate(response);
});

test("operational failures are stage-only, retryable and never expose secrets", async () => {
  const privateValues = [
    TOKEN,
    LOOKUP_KEYS.currentHash,
    "kupac@example.test",
    "raw database failure",
  ];
  const scenarios: Array<{
    stage: PasswordResetConfirmFailure["stage"];
    overrides: Partial<PasswordResetConfirmHandlerDependencies>;
  }> = [
    {
      stage: "RATE_LIMIT",
      overrides: {
        checkRateLimit() {
          throw new Error(privateValues.join(" "));
        },
      },
    },
    {
      stage: "PASSWORD_VALIDATION",
      overrides: {
        validatePassword() {
          throw new Error(privateValues.join(" "));
        },
      },
    },
    {
      stage: "TOKEN_KEYS",
      overrides: {
        createLookupKeys() {
          throw new Error(privateValues.join(" "));
        },
      },
    },
    {
      stage: "HASH_LOOKUP",
      overrides: {
        async findByCurrentHash() {
          throw new Error(privateValues.join(" "));
        },
      },
    },
    {
      stage: "LEGACY_LOOKUP",
      overrides: {
        async findByCurrentHash() {
          return null;
        },
        async findByLegacyToken() {
          throw new Error(privateValues.join(" "));
        },
      },
    },
    {
      stage: "EXPIRY_CHECK",
      overrides: {
        async findByCurrentHash() {
          return currentRecord({ expires: new Date(Number.NaN) });
        },
      },
    },
    {
      stage: "PASSWORD_HASH",
      overrides: {
        async hashPassword() {
          throw new Error(privateValues.join(" "));
        },
      },
    },
    {
      stage: "RESPONSE_PREPARATION",
      overrides: {
        prepareSuccessResponse() {
          throw new Error(privateValues.join(" "));
        },
      },
    },
    {
      stage: "COMMIT",
      overrides: {
        async commitReset() {
          throw new Error(privateValues.join(" "));
        },
      },
    },
  ];

  for (const scenario of scenarios) {
    const harness = createHarness(scenario.overrides);
    const response = await harness.handler(
      request({ token: TOKEN, password: PASSWORD }),
    );
    const responseText = await response.text();

    assert.equal(response.status, 503, scenario.stage);
    assert.equal(
      responseText,
      JSON.stringify({ error: PASSWORD_RESET_CONFIRM_RETRY_MESSAGE }),
    );
    assert.deepEqual(harness.failures, [{ stage: scenario.stage }]);
    for (const privateValue of privateValues) {
      assert.equal(responseText.includes(privateValue), false);
      assert.equal(
        JSON.stringify(harness.failures).includes(privateValue),
        false,
      );
    }
    assertPrivate(response);
  }
});

test("rate limiting and success both receive the complete private policy", async () => {
  const rateLimited = createHarness({
    checkRateLimit() {
      return false;
    },
  });
  const limitedResponse = await rateLimited.handler(
    request({ token: TOKEN, password: PASSWORD }),
  );
  assert.equal(limitedResponse.status, 429);
  assertPrivate(limitedResponse);

  const successful = createHarness();
  const successResponse = await successful.handler(
    request({ token: TOKEN, password: PASSWORD }),
  );
  assert.equal(successResponse.status, 200);
  assertPrivate(successResponse);
});
