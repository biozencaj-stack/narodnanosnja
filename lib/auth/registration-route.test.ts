import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { hashCredentialToken } from "./credential-token";
import {
  MAX_REGISTRATION_NAME_LENGTH,
  MAX_REGISTRATION_PHONE_LENGTH,
  MAX_REGISTRATION_JSON_BYTES,
  REGISTRATION_ACCEPTED_MESSAGE,
  REGISTRATION_UNAVAILABLE_MESSAGE,
  createRegistrationHandler,
  type RegistrationFailure,
  type RegistrationHandlerDependencies,
} from "./registration-route";
import type { RegistrationInput } from "./registration";

const ENDPOINT = "https://shop.example.test/api/auth/register";
const TOKEN = "a".repeat(64);
const TOKEN_HASH = hashCredentialToken("email-verification", TOKEN);
if (!TOKEN_HASH) throw new Error("Test token must produce a hash");
const ISSUED_AT = new Date("2026-08-30T15:00:00.000Z");
const VALID_BODY = {
  email: "  KUPAC@EXAMPLE.COM ",
  password: "DobraLozinka1!",
  firstName: " Kupac ",
  lastName: " Test ",
  phone: " +381 60 123 456 ",
};
const encoder = new TextEncoder();

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

function createHarness(
  result: "created" | "existing" = "created",
) {
  const events: string[] = [];
  const failures: RegistrationFailure[] = [];
  const scheduledTasks: Array<() => Promise<void>> = [];
  const registrations: RegistrationInput[] = [];
  const dependencies: RegistrationHandlerDependencies = {
    checkRateLimit(key, limit) {
      events.push(`rate:${key}:${limit}`);
      return true;
    },
    validatePassword(password) {
      events.push(`validate-password:${password}`);
      return { valid: true, errors: [] };
    },
    generateToken() {
      events.push("generate-token");
      return TOKEN;
    },
    hashToken(token) {
      events.push(`hash-token:${token}`);
      return TOKEN_HASH;
    },
    prepareDelivery(email, firstName, token) {
      events.push(`prepare:${email}:${firstName}:${token}`);
      return async () => {
        events.push(`deliver:${email}:${firstName}:${token}`);
      };
    },
    async hashPassword(password) {
      events.push(`hash-password:${password}`);
      return "prepared-bcrypt-hash";
    },
    async register(input) {
      events.push("register");
      registrations.push(input);
      return { kind: result };
    },
    async recoverExistingVerification(email) {
      events.push(`recover:${email}`);
    },
    schedule(task) {
      events.push("schedule");
      scheduledTasks.push(task);
    },
    async protectResponseTiming(startedAt) {
      assert.equal(Number.isFinite(startedAt), true);
      events.push("protect-response-timing");
    },
    now() {
      events.push("now");
      return ISSUED_AT;
    },
    reportFailure(failure) {
      failures.push(failure);
    },
  };

  return {
    handler: createRegistrationHandler(dependencies),
    dependencies,
    events,
    failures,
    scheduledTasks,
    registrations,
  };
}

function assertPrivate(response: Response): void {
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

test("same-origin guard runs before limiter, JSON, bcrypt and database", async () => {
  const harness = createHarness();
  harness.dependencies.checkRateLimit = () => {
    throw new Error("must not run");
  };

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

test("registration rejects declared and streamed bodies above 4096 bytes before shape work", async () => {
  const declared = createHarness();
  const declaredResponse = await declared.handler(
    request("{}", {
      host: "shop.example.test",
      origin: "https://shop.example.test",
      "content-length": String(MAX_REGISTRATION_JSON_BYTES + 1),
    }),
  );

  assert.equal(declaredResponse.status, 413);
  assert.deepEqual(declared.events, ["rate:register:unknown:5"]);
  assertPrivate(declaredResponse);

  const source = `${JSON.stringify(VALID_BODY)}${" ".repeat(
    MAX_REGISTRATION_JSON_BYTES + 1 - JSON.stringify(VALID_BODY).length,
  )}`;
  const bytes = encoder.encode(source);
  assert.equal(bytes.byteLength, MAX_REGISTRATION_JSON_BYTES + 1);
  const streamed = streamedRequest(
    [
      bytes.subarray(0, MAX_REGISTRATION_JSON_BYTES),
      bytes.subarray(MAX_REGISTRATION_JSON_BYTES),
    ],
    { close: false },
  );
  const actual = createHarness();
  const streamedResponse = await actual.handler(streamed.request);

  assert.equal(streamedResponse.status, 413);
  assert.deepEqual(actual.events, ["rate:register:unknown:5"]);
  assert.equal(streamed.wasCancelled(), true);
  assertPrivate(streamedResponse);
});

test("registration accepts valid JSON at the exact 4096-byte boundary", async () => {
  const serialized = JSON.stringify(VALID_BODY);
  const exactBody = `${serialized}${" ".repeat(
    MAX_REGISTRATION_JSON_BYTES - encoder.encode(serialized).byteLength,
  )}`;
  assert.equal(encoder.encode(exactBody).byteLength, MAX_REGISTRATION_JSON_BYTES);
  const harness = createHarness();

  const response = await harness.handler(request(exactBody));

  assert.equal(response.status, 202);
  assert.equal(harness.registrations.length, 1);
  assertPrivate(response);
});

test("registration rejects unsupported body metadata and malformed UTF-8 after the limiter", async () => {
  const metadataCases = [
    request(JSON.stringify(VALID_BODY), {
      host: "shop.example.test",
      origin: "https://shop.example.test",
      "content-type": "text/plain",
    }),
    request(JSON.stringify(VALID_BODY), {
      host: "shop.example.test",
      origin: "https://shop.example.test",
      "content-encoding": "gzip",
    }),
  ];

  for (const invalidRequest of metadataCases) {
    const harness = createHarness();
    const response = await harness.handler(invalidRequest);

    assert.equal(response.status, 415);
    assert.deepEqual(harness.events, ["rate:register:unknown:5"]);
    assertPrivate(response);
  }

  const invalidUtf8 = streamedRequest(
    [new Uint8Array([0x7b, 0x22, 0x80, 0x22, 0x7d])],
  );
  const harness = createHarness();
  const response = await harness.handler(invalidUtf8.request);

  assert.equal(response.status, 400);
  assert.deepEqual(harness.events, ["rate:register:unknown:5"]);
  assertPrivate(response);
});

test("malformed, unexpected and oversized values stop before token work", async () => {
  const invalidBodies: unknown[] = [
    "{",
    [],
    null,
    { ...VALID_BODY, unexpected: true },
    { ...VALID_BODY, email: { address: "kupac@example.com" } },
    { ...VALID_BODY, firstName: "x".repeat(MAX_REGISTRATION_NAME_LENGTH + 1) },
    { ...VALID_BODY, firstName: "Kupac\nNapad" },
    { ...VALID_BODY, lastName: 123 },
    { ...VALID_BODY, phone: null },
    { ...VALID_BODY, phone: "1".repeat(MAX_REGISTRATION_PHONE_LENGTH + 1) },
    { ...VALID_BODY, password: { secret: "DobraLozinka1!" } },
    { ...VALID_BODY, password: `A1!${"x".repeat(70)}` },
  ];

  for (const body of invalidBodies) {
    const harness = createHarness();
    const response = await harness.handler(request(body));

    assert.equal(response.status, 400);
    assert.equal(
      harness.events.some((event) => event === "generate-token"),
      false,
    );
    assert.equal(harness.registrations.length, 0);
    assertPrivate(response);
  }
});

test("password policy failure is public validation and stops before token work", async () => {
  const harness = createHarness();
  harness.dependencies.validatePassword = () => ({
    valid: false,
    errors: ["Lozinka mora sadržati bar jedno veliko slovo"],
  });

  const response = await harness.handler(request(VALID_BODY));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Lozinka mora sadržati bar jedno veliko slovo",
  });
  assert.equal(harness.events.includes("generate-token"), false);
  assert.equal(harness.registrations.length, 0);
});

test("delivery is prepared and bcrypt completes before atomic persistence", async () => {
  const harness = createHarness("created");

  const response = await harness.handler(request(VALID_BODY));

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    message: REGISTRATION_ACCEPTED_MESSAGE,
  });
  assert.deepEqual(harness.events, [
    "rate:register:unknown:5",
    `validate-password:${VALID_BODY.password}`,
    "generate-token",
    `hash-token:${TOKEN}`,
    `prepare:kupac@example.com:Kupac:${TOKEN}`,
    `hash-password:${VALID_BODY.password}`,
    "now",
    "register",
    "schedule",
    "protect-response-timing",
  ]);
  assert.deepEqual(harness.registrations, [
    {
      normalizedEmail: "kupac@example.com",
      passwordHash: "prepared-bcrypt-hash",
      firstName: "Kupac",
      lastName: "Test",
      phone: "+381 60 123 456",
      legacyPlaintextToken: TOKEN,
      tokenHash: TOKEN_HASH,
      issuedAt: ISSUED_AT,
    },
  ]);
  assert.equal(harness.scheduledTasks.length, 1);
  assert.equal(harness.events.some((event) => event.startsWith("deliver:")), false);

  await harness.scheduledTasks[0]();
  assert.equal(harness.events.at(-1), `deliver:kupac@example.com:Kupac:${TOKEN}`);
  assert.deepEqual(harness.failures, []);
  assertPrivate(response);
});

test("created and existing outcomes schedule recovery and return byte-identical 202", async () => {
  const created = createHarness("created");
  const existing = createHarness("existing");

  const createdResponse = await created.handler(request(VALID_BODY));
  const existingResponse = await existing.handler(request(VALID_BODY));
  const [createdText, existingText] = await Promise.all([
    createdResponse.text(),
    existingResponse.text(),
  ]);

  assert.equal(createdResponse.status, 202);
  assert.equal(existingResponse.status, 202);
  assert.equal(createdText, existingText);
  assert.equal(created.scheduledTasks.length, 1);
  assert.equal(existing.scheduledTasks.length, 1);

  await Promise.all([
    created.scheduledTasks[0](),
    existing.scheduledTasks[0](),
  ]);
  assert.equal(created.events.some((event) => event.startsWith("deliver:")), true);
  assert.equal(existing.events.some((event) => event.startsWith("deliver:")), false);
  assert.equal(existing.events.at(-1), "recover:kupac@example.com");
});

test("internal failures become stage-only retryable responses", async () => {
  const scenarios: Array<{
    stage: RegistrationFailure["stage"];
    configure: (dependencies: RegistrationHandlerDependencies) => void;
  }> = [
    {
      stage: "RATE_LIMIT",
      configure(dependencies) {
        dependencies.checkRateLimit = () => {
          throw new Error("limiter private details");
        };
      },
    },
    {
      stage: "TOKEN_PREPARATION",
      configure(dependencies) {
        dependencies.hashToken = () => null;
      },
    },
    {
      stage: "PASSWORD_HASH",
      configure(dependencies) {
        dependencies.hashPassword = async () => {
          throw new Error("bcrypt private details");
        };
      },
    },
    {
      stage: "PERSISTENCE",
      configure(dependencies) {
        dependencies.register = async () => {
          throw new Error(`database rejected ${VALID_BODY.email}`);
        };
      },
    },
  ];

  for (const scenario of scenarios) {
    const harness = createHarness();
    scenario.configure(harness.dependencies);
    const response = await createRegistrationHandler(harness.dependencies)(
      request(VALID_BODY),
    );

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: REGISTRATION_UNAVAILABLE_MESSAGE,
    });
    assert.deepEqual(harness.failures, [{ stage: scenario.stage }]);
    assert.equal(JSON.stringify(harness.failures).includes("kupac@example.com"), false);
    assertPrivate(response);
  }
});

test("scheduling failure after commit stays private and returns accepted", async () => {
  const harness = createHarness();
  harness.dependencies.schedule = () => {
    throw new Error("scheduler unavailable");
  };

  const response = await createRegistrationHandler(harness.dependencies)(
    request(VALID_BODY),
  );

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), {
    message: REGISTRATION_ACCEPTED_MESSAGE,
  });
  assert.deepEqual(harness.failures, [{ stage: "SCHEDULING" }]);
  assert.equal(harness.events.at(-1), "protect-response-timing");
  assertPrivate(response);
});

test("existing-account recovery failure is stage-only and cannot change 202", async () => {
  const harness = createHarness("existing");
  harness.dependencies.recoverExistingVerification = async () => {
    throw new Error(`private recovery details for ${VALID_BODY.email}`);
  };

  const response = await createRegistrationHandler(harness.dependencies)(
    request(VALID_BODY),
  );

  assert.equal(response.status, 202);
  assert.equal(harness.scheduledTasks.length, 1);
  await harness.scheduledTasks[0]();
  assert.deepEqual(harness.failures, [{ stage: "RECOVERY" }]);
  assert.equal(JSON.stringify(harness.failures).includes("kupac@example.com"), false);
});

test("delivery failure is private and does not replace the accepted response", async () => {
  const harness = createHarness();
  harness.dependencies.prepareDelivery = () => async () => {
    throw new Error(`SMTP rejected ${VALID_BODY.email} token ${TOKEN}`);
  };
  harness.dependencies.reportFailure = (failure) => {
    harness.failures.push(failure);
    throw new Error("logger unavailable");
  };
  const handler = createRegistrationHandler(harness.dependencies);

  const response = await handler(request(VALID_BODY));

  assert.equal(response.status, 202);
  assert.equal(harness.scheduledTasks.length, 1);
  await harness.scheduledTasks[0]();
  assert.deepEqual(harness.failures, [{ stage: "DELIVERY" }]);
  assert.equal(JSON.stringify(harness.failures).includes(TOKEN), false);
});
