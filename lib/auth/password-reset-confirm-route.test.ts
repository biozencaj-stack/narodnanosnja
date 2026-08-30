import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest, NextResponse } from "next/server";
import { createCredentialTokenLookupKeys } from "./credential-token";
import { PasswordResetConfirmConflictError } from "./password-reset-confirm";
import {
  MAX_BCRYPT_PASSWORD_BYTES,
  MAX_PASSWORD_RESET_CONFIRM_JSON_BYTES,
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
const encoder = new TextEncoder();
const lookupKeys = createCredentialTokenLookupKeys("password-reset", TOKEN);
if (!lookupKeys) throw new Error("Test token must produce lookup keys");
const LOOKUP_KEYS = lookupKeys;

function request(
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(ENDPOINT, {
    method: "POST",
    headers: {
      host: "shop.example.test",
      origin: "https://shop.example.test",
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function streamedRequest(
  chunks: Uint8Array[],
  options: {
    headers?: Record<string, string>;
    close?: boolean;
  } = {},
): { request: NextRequest; wasCancelled: () => boolean } {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (options.close !== false) controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });

  return {
    request: {
      headers: new Headers({
        host: "shop.example.test",
        origin: "https://shop.example.test",
        "content-type": "application/json",
        ...options.headers,
      }),
      body,
    } as unknown as NextRequest,
    wasCancelled: () => cancelled,
  };
}

function unreadableRequest(
  headers: Record<string, string>,
): { request: NextRequest; bodyReadCount: () => number } {
  let reads = 0;
  return {
    request: {
      headers: new Headers(headers),
      body: {
        getReader() {
          reads += 1;
          throw new Error("body must not be read");
        },
      },
    } as unknown as NextRequest,
    bodyReadCount: () => reads,
  };
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

  const guarded = unreadableRequest({
    host: "shop.example.test",
    origin: "https://attacker.example",
    "content-type": "application/json",
  });
  const response = await harness.handler(guarded.request);

  assert.equal(response.status, 403);
  assert.equal(guarded.bodyReadCount(), 0);
  assert.deepEqual(harness.events, []);
  assert.deepEqual(harness.failures, []);
  assertPrivate(response);
});

test("malformed JSON, non-exact shapes and overlong bcrypt values stop before lookup", async () => {
  const malformedJson = createHarness();
  const malformedResponse = await malformedJson.handler(request("{"));
  assert.equal(malformedResponse.status, 400);
  assert.deepEqual(malformedJson.events, ["rate-limit"]);

  const invalidBodies = [
    [],
    null,
    { token: TOKEN, password: PASSWORD, unexpected: true },
    { token: TOKEN },
    { password: PASSWORD },
    { payload: { token: TOKEN, password: PASSWORD } },
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

test("declared and streamed bodies above 1024 bytes are rejected before shape or token work", async () => {
  const declared = createHarness();
  const declaredResponse = await declared.handler(
    request("{}", {
      "content-length": String(
        MAX_PASSWORD_RESET_CONFIRM_JSON_BYTES + 1,
      ),
    }),
  );

  assert.equal(declaredResponse.status, 413);
  assert.deepEqual(await declaredResponse.json(), {
    error: "Zahtev je prevelik.",
  });
  assert.deepEqual(declared.events, ["rate-limit"]);
  assertPrivate(declaredResponse);

  const validJson = JSON.stringify({ token: TOKEN, password: PASSWORD });
  const oversizedSource = `${validJson}${" ".repeat(
    MAX_PASSWORD_RESET_CONFIRM_JSON_BYTES + 1 -
      encoder.encode(validJson).byteLength,
  )}`;
  const oversizedBytes = encoder.encode(oversizedSource);
  assert.equal(
    oversizedBytes.byteLength,
    MAX_PASSWORD_RESET_CONFIRM_JSON_BYTES + 1,
  );
  const streamed = streamedRequest(
    [
      oversizedBytes.subarray(0, MAX_PASSWORD_RESET_CONFIRM_JSON_BYTES),
      oversizedBytes.subarray(MAX_PASSWORD_RESET_CONFIRM_JSON_BYTES),
    ],
    { close: false },
  );
  const actual = createHarness();
  const streamedResponse = await actual.handler(streamed.request);

  assert.equal(streamedResponse.status, 413);
  assert.deepEqual(await streamedResponse.json(), {
    error: "Zahtev je prevelik.",
  });
  assert.deepEqual(actual.events, ["rate-limit"]);
  assert.equal(streamed.wasCancelled(), true);
  assertPrivate(streamedResponse);
});

test("valid confirm JSON is accepted at the exact 1024-byte boundary", async () => {
  const serialized = JSON.stringify({ token: TOKEN, password: PASSWORD });
  const exactBody = `${serialized}${" ".repeat(
    MAX_PASSWORD_RESET_CONFIRM_JSON_BYTES -
      encoder.encode(serialized).byteLength,
  )}`;
  assert.equal(
    encoder.encode(exactBody).byteLength,
    MAX_PASSWORD_RESET_CONFIRM_JSON_BYTES,
  );
  const harness = createHarness();

  const response = await harness.handler(request(exactBody));

  assert.equal(response.status, 200);
  assert.equal(harness.commits.length, 1);
  assertPrivate(response);
});

test("unsupported content metadata and malformed UTF-8 stop after the limiter", async () => {
  const metadataCases = [
    request(JSON.stringify({ token: TOKEN, password: PASSWORD }), {
      "content-type": "text/plain",
    }),
    request(JSON.stringify({ token: TOKEN, password: PASSWORD }), {
      "content-encoding": "gzip",
    }),
  ];

  for (const invalidRequest of metadataCases) {
    const harness = createHarness();
    const response = await harness.handler(invalidRequest);

    assert.equal(response.status, 415);
    assert.deepEqual(await response.json(), {
      error: "Nepodržan format zahteva.",
    });
    assert.deepEqual(harness.events, ["rate-limit"]);
    assertPrivate(response);
  }

  const invalidUtf8 = streamedRequest([
    new Uint8Array([0x7b, 0x22, 0x80, 0x22, 0x7d]),
  ]);
  const harness = createHarness();
  const response = await harness.handler(invalidUtf8.request);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Neispravan zahtev" });
  assert.deepEqual(harness.events, ["rate-limit"]);
  assertPrivate(response);
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
        async commitReset() {
          throw new PasswordResetConfirmConflictError();
        },
      },
    },
    {
      name: "boundary",
      overrides: {
        async findByCurrentHash() {
          return currentRecord({ expires: RESET_AT });
        },
        async commitReset() {
          throw new PasswordResetConfirmConflictError();
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

test("DB expiry discovered at commit discards the prepared success", async () => {
  const harness = createHarness({
    async findByCurrentHash() {
      harness.events.push("hash-lookup");
      return currentRecord({
        expires: new Date(RESET_AT.getTime() + 30_000),
      });
    },
    async commitReset() {
      harness.events.push("commit-expired");
      throw new PasswordResetConfirmConflictError();
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
    "commit-expired",
  ]);
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
