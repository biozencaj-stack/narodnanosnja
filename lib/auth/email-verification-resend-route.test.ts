import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  EMAIL_VERIFICATION_RESEND_ACCEPTED_MESSAGE,
  EMAIL_VERIFICATION_RESEND_UNAVAILABLE_MESSAGE,
} from "./email-verification-resend";
import {
  EMAIL_VERIFICATION_RESEND_PRIVATE_HEADERS,
  MAX_EMAIL_VERIFICATION_RESEND_JSON_BYTES,
  createEmailVerificationResendHandler,
  type EmailVerificationResendRouteDependencies,
} from "./email-verification-resend-route";

const ENDPOINT =
  "https://shop.example.com/api/auth/verify-email/resend";
const encoder = new TextEncoder();

function request(
  body: string,
  headers: Record<string, string> = {
    host: "shop.example.com",
    origin: "https://shop.example.com",
    "content-type": "application/json",
  },
): NextRequest {
  return new NextRequest(ENDPOINT, {
    method: "POST",
    headers,
    body,
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
        host: "shop.example.com",
        origin: "https://shop.example.com",
        "content-type": "application/json",
        ...options.headers,
      }),
      body,
    } as unknown as NextRequest,
    wasCancelled: () => cancelled,
  };
}

function assertPrivate(response: Response): void {
  for (const [name, value] of Object.entries(
    EMAIL_VERIFICATION_RESEND_PRIVATE_HEADERS,
  )) {
    assert.equal(response.headers.get(name), value);
  }
}

function dependencies(
  calls: string[],
  scheduled: Array<() => Promise<void>>,
  overrides: Partial<EmailVerificationResendRouteDependencies> = {},
): EmailVerificationResendRouteDependencies {
  return {
    checkRateLimit(key, limit) {
      calls.push(`limit:${key}:${limit}`);
      return true;
    },
    schedule(task) {
      calls.push("schedule");
      scheduled.push(task);
    },
    async processRequest(email) {
      calls.push(`process:${email}`);
    },
    reportFailure({ stage }) {
      calls.push(`failure:${stage}`);
    },
    ...overrides,
  };
}

test("resend rejects an untrusted write before limiter and body parsing", async () => {
  const calls: string[] = [];
  const scheduled: Array<() => Promise<void>> = [];
  const handler = createEmailVerificationResendHandler(
    dependencies(calls, scheduled),
  );

  const response = await handler(
    request("not-json", {
      host: "shop.example.com",
      origin: "https://attacker.example",
    }),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Zahtev za ponovnu potvrdu emaila nije dozvoljen.",
  });
  assert.deepEqual(calls, []);
  assert.deepEqual(scheduled, []);
  assertPrivate(response);
});

test("resend rate limit is account-independent and runs before body parsing", async () => {
  const calls: string[] = [];
  const scheduled: Array<() => Promise<void>> = [];
  const handler = createEmailVerificationResendHandler(
    dependencies(calls, scheduled, {
      checkRateLimit(key, limit) {
        calls.push(`limit:${key}:${limit}`);
        return false;
      },
    }),
  );

  const response = await handler(
    request("not-json", {
      host: "shop.example.com",
      origin: "https://shop.example.com",
      "x-forwarded-for": "203.0.113.9",
    }),
  );

  assert.equal(response.status, 429);
  assert.deepEqual(calls, ["limit:verify-email-resend:203.0.113.9:3"]);
  assert.deepEqual(scheduled, []);
  assertPrivate(response);
});

test("resend rejects declared and streamed bodies above 1024 bytes before email work", async () => {
  const declaredCalls: string[] = [];
  const declaredScheduled: Array<() => Promise<void>> = [];
  const declaredHandler = createEmailVerificationResendHandler(
    dependencies(declaredCalls, declaredScheduled),
  );
  const declaredResponse = await declaredHandler(
    request("{}", {
      host: "shop.example.com",
      origin: "https://shop.example.com",
      "content-type": "application/json",
      "content-length": String(MAX_EMAIL_VERIFICATION_RESEND_JSON_BYTES + 1),
    }),
  );

  assert.equal(declaredResponse.status, 413);
  assert.deepEqual(declaredCalls, ["limit:verify-email-resend:unknown:3"]);
  assert.deepEqual(declaredScheduled, []);
  assertPrivate(declaredResponse);

  const validJson = JSON.stringify({ email: "kupac@example.com" });
  const source = `${validJson}${" ".repeat(
    MAX_EMAIL_VERIFICATION_RESEND_JSON_BYTES + 1 - validJson.length,
  )}`;
  const bytes = encoder.encode(source);
  assert.equal(bytes.byteLength, MAX_EMAIL_VERIFICATION_RESEND_JSON_BYTES + 1);
  const streamed = streamedRequest(
    [
      bytes.subarray(0, MAX_EMAIL_VERIFICATION_RESEND_JSON_BYTES),
      bytes.subarray(MAX_EMAIL_VERIFICATION_RESEND_JSON_BYTES),
    ],
    { close: false },
  );
  const streamedCalls: string[] = [];
  const streamedScheduled: Array<() => Promise<void>> = [];
  const streamedHandler = createEmailVerificationResendHandler(
    dependencies(streamedCalls, streamedScheduled),
  );
  const streamedResponse = await streamedHandler(streamed.request);

  assert.equal(streamedResponse.status, 413);
  assert.deepEqual(streamedCalls, ["limit:verify-email-resend:unknown:3"]);
  assert.deepEqual(streamedScheduled, []);
  assert.equal(streamed.wasCancelled(), true);
  assertPrivate(streamedResponse);
});

test("resend accepts valid JSON at the exact 1024-byte boundary", async () => {
  const calls: string[] = [];
  const scheduled: Array<() => Promise<void>> = [];
  const handler = createEmailVerificationResendHandler(
    dependencies(calls, scheduled),
  );
  const serialized = JSON.stringify({ email: "kupac@example.com" });
  const exactBody = `${serialized}${" ".repeat(
    MAX_EMAIL_VERIFICATION_RESEND_JSON_BYTES -
      encoder.encode(serialized).byteLength,
  )}`;
  assert.equal(
    encoder.encode(exactBody).byteLength,
    MAX_EMAIL_VERIFICATION_RESEND_JSON_BYTES,
  );

  const response = await handler(request(exactBody));

  assert.equal(response.status, 202);
  assert.equal(scheduled.length, 1);
  assertPrivate(response);
});

test("resend rejects unsupported body metadata and malformed UTF-8 after the limiter", async () => {
  const metadataRequests = [
    request('{"email":"kupac@example.com"}', {
      host: "shop.example.com",
      origin: "https://shop.example.com",
      "content-type": "text/plain",
    }),
    request('{"email":"kupac@example.com"}', {
      host: "shop.example.com",
      origin: "https://shop.example.com",
      "content-type": "application/json",
      "content-encoding": "br",
    }),
  ];

  for (const invalidRequest of metadataRequests) {
    const calls: string[] = [];
    const scheduled: Array<() => Promise<void>> = [];
    const handler = createEmailVerificationResendHandler(
      dependencies(calls, scheduled),
    );
    const response = await handler(invalidRequest);

    assert.equal(response.status, 415);
    assert.deepEqual(calls, ["limit:verify-email-resend:unknown:3"]);
    assert.deepEqual(scheduled, []);
    assertPrivate(response);
  }

  const invalidUtf8 = streamedRequest(
    [new Uint8Array([0x7b, 0x22, 0x80, 0x22, 0x7d])],
  );
  const calls: string[] = [];
  const scheduled: Array<() => Promise<void>> = [];
  const handler = createEmailVerificationResendHandler(
    dependencies(calls, scheduled),
  );
  const response = await handler(invalidUtf8.request);

  assert.equal(response.status, 400);
  assert.deepEqual(calls, ["limit:verify-email-resend:unknown:3"]);
  assert.deepEqual(scheduled, []);
  assertPrivate(response);
});

test("resend fails closed with a private stage-only response when the limiter throws", async () => {
  const calls: string[] = [];
  const scheduled: Array<() => Promise<void>> = [];
  const handler = createEmailVerificationResendHandler(
    dependencies(calls, scheduled, {
      checkRateLimit(key, limit) {
        calls.push(`limit:${key}:${limit}`);
        throw new Error("shared limiter credentials and private details");
      },
      reportFailure({ stage }) {
        calls.push(`failure:${stage}`);
        throw new Error("logger unavailable");
      },
    }),
  );

  const response = await handler(
    request("not-json", {
      host: "shop.example.com",
      origin: "https://shop.example.com",
      "x-forwarded-for": "203.0.113.10",
    }),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: EMAIL_VERIFICATION_RESEND_UNAVAILABLE_MESSAGE,
  });
  assert.deepEqual(calls, [
    "limit:verify-email-resend:203.0.113.10:3",
    "failure:RATE_LIMIT",
  ]);
  assert.deepEqual(scheduled, []);
  assertPrivate(response);
});

test("malformed JSON and invalid emails never schedule private work", async () => {
  for (const body of ["not-json", JSON.stringify({ email: "invalid" })]) {
    const calls: string[] = [];
    const scheduled: Array<() => Promise<void>> = [];
    const handler = createEmailVerificationResendHandler(
      dependencies(calls, scheduled),
    );

    const response = await handler(request(body));

    assert.equal(response.status, 400);
    assert.equal(calls.length, 1);
    assert.match(calls[0] ?? "", /^limit:/);
    assert.deepEqual(scheduled, []);
    assertPrivate(response);
  }
});

test("resend accepts only a plain JSON object with exactly the email field", async () => {
  const rejectedBodies = [
    JSON.stringify([]),
    JSON.stringify(null),
    JSON.stringify({}),
    JSON.stringify({ email: "kupac@example.com", unexpected: true }),
    JSON.stringify({ value: "kupac@example.com" }),
  ];

  for (const body of rejectedBodies) {
    const calls: string[] = [];
    const scheduled: Array<() => Promise<void>> = [];
    const handler = createEmailVerificationResendHandler(
      dependencies(calls, scheduled),
    );

    const response = await handler(request(body));

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Neispravan zahtev" });
    assert.deepEqual(calls, ["limit:verify-email-resend:unknown:3"]);
    assert.deepEqual(scheduled, []);
    assertPrivate(response);
  }
});

test("every valid email gets the same immediate 202 before private work", async () => {
  const calls: string[] = [];
  const scheduled: Array<() => Promise<void>> = [];
  const handler = createEmailVerificationResendHandler(
    dependencies(calls, scheduled),
  );

  const responses = await Promise.all([
    handler(request(JSON.stringify({ email: " KUPAC@Example.COM " }))),
    handler(request(JSON.stringify({ email: "absent@example.com" }))),
  ]);

  assert.equal(scheduled.length, 2);
  assert.equal(calls.some((call) => call.startsWith("process:")), false);
  for (const response of responses) {
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), {
      message: EMAIL_VERIFICATION_RESEND_ACCEPTED_MESSAGE,
    });
    assertPrivate(response);
  }

  await Promise.all(scheduled.map((task) => task()));
  assert.deepEqual(
    calls.filter((call) => call.startsWith("process:")).sort(),
    ["process:absent@example.com", "process:kupac@example.com"],
  );
});

test("synchronous scheduler failure is the only valid-request 503", async () => {
  const calls: string[] = [];
  const scheduled: Array<() => Promise<void>> = [];
  const handler = createEmailVerificationResendHandler(
    dependencies(calls, scheduled, {
      schedule() {
        throw new Error("scheduler unavailable");
      },
    }),
  );

  const response = await handler(
    request(JSON.stringify({ email: "kupac@example.com" })),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(calls, [
    "limit:verify-email-resend:unknown:3",
    "failure:SCHEDULING",
  ]);
  assertPrivate(response);
});

test("background failure stays behind the already returned generic 202", async () => {
  const calls: string[] = [];
  const scheduled: Array<() => Promise<void>> = [];
  const handler = createEmailVerificationResendHandler(
    dependencies(calls, scheduled, {
      async processRequest() {
        throw new Error("database unavailable");
      },
    }),
  );

  const response = await handler(
    request(JSON.stringify({ email: "kupac@example.com" })),
  );
  assert.equal(response.status, 202);
  await scheduled[0]?.();
  assert.equal(calls.includes("failure:BACKGROUND"), true);
  assertPrivate(response);
});
