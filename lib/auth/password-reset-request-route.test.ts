import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  PASSWORD_RESET_ACCEPTED_MESSAGE,
  PASSWORD_RESET_UNAVAILABLE_MESSAGE,
} from "./password-reset-request";
import {
  MAX_PASSWORD_RESET_REQUEST_JSON_BYTES,
  createPasswordResetRequestHandler,
} from "./password-reset-request-route";

const ENDPOINT = "https://example.test/api/auth/reset-password/request";
const ACCEPTED_TEXT = JSON.stringify({
  message: PASSWORD_RESET_ACCEPTED_MESSAGE,
});
const encoder = new TextEncoder();

function requestWithBody(
  body: string,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(ENDPOINT, {
    method: "POST",
    headers: {
      host: "example.test",
      origin: "https://example.test",
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
      ...headers,
    },
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
        host: "example.test",
        origin: "https://example.test",
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.10",
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

test("same-origin guard runs before rate limiting, body parsing and private work", async () => {
  const calls: string[] = [];
  const guardedRequest = unreadableRequest({
    host: "example.test",
    origin: "https://attacker.example",
    "content-type": "application/json",
  });
  const handler = createPasswordResetRequestHandler({
    checkRateLimit() {
      calls.push("rate-limit");
      return true;
    },
    schedule() {
      calls.push("schedule");
    },
    async processRequest() {
      calls.push("process");
    },
    reportFailure() {
      calls.push("failure");
    },
  });

  const response = await handler(guardedRequest.request);

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Zahtev za resetovanje lozinke nije dozvoljen.",
  });
  assert.equal(guardedRequest.bodyReadCount(), 0);
  assert.deepEqual(calls, []);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("pragma"), "no-cache");
});

test("all valid-email account outcomes have the exact same immediate HTTP response", async () => {
  const privateFailure = "SMTP rejected secret recipient";
  const scenarios = [
    { name: "absent account", process: async () => {} },
    { name: "successful delivery", process: async () => {} },
    {
      name: "private background failure",
      process: async () => {
        throw new Error(privateFailure);
      },
    },
  ];
  const publicSnapshots: Array<Record<string, string | number | null>> = [];

  for (const scenario of scenarios) {
    const tasks: Array<() => Promise<void>> = [];
    const failures: Array<{ stage: string }> = [];
    const processedEmails: string[] = [];
    let processCalls = 0;
    const handler = createPasswordResetRequestHandler({
      checkRateLimit: () => true,
      schedule(task) {
        tasks.push(task);
      },
      async processRequest(email) {
        processCalls += 1;
        processedEmails.push(email);
        await scenario.process();
      },
      reportFailure(failure) {
        failures.push(failure);
      },
    });

    const response = await handler(
      requestWithBody(JSON.stringify({ email: "KUPAC@EXAMPLE.COM" })),
    );
    const responseText = await response.text();

    publicSnapshots.push({
      name: scenario.name,
      status: response.status,
      text: responseText,
      cacheControl: response.headers.get("cache-control"),
      contentType: response.headers.get("content-type"),
      pragma: response.headers.get("pragma"),
    });
    assert.equal(processCalls, 0);
    assert.equal(tasks.length, 1);

    await tasks[0]();
    assert.equal(processCalls, 1);
    assert.deepEqual(processedEmails, ["kupac@example.com"]);
    if (scenario.name === "private background failure") {
      assert.deepEqual(failures, [{ stage: "BACKGROUND" }]);
      assert.equal(JSON.stringify(failures).includes(privateFailure), false);
    } else {
      assert.deepEqual(failures, []);
    }
  }

  for (const snapshot of publicSnapshots) {
    assert.equal(snapshot.status, 202);
    assert.equal(snapshot.text, ACCEPTED_TEXT);
    assert.equal(snapshot.cacheControl, "no-store, max-age=0");
    assert.match(String(snapshot.contentType), /^application\/json/);
    assert.equal(snapshot.pragma, "no-cache");
    assert.equal(String(snapshot.text).includes("kupac@example.com"), false);
    assert.equal(String(snapshot.text).toLowerCase().includes("smtp"), false);
  }

  assert.deepEqual(
    publicSnapshots.map((snapshot) => ({
      status: snapshot.status,
      text: snapshot.text,
      cacheControl: snapshot.cacheControl,
      contentType: snapshot.contentType,
      pragma: snapshot.pragma,
    })),
    Array(3).fill({
      status: 202,
      text: ACCEPTED_TEXT,
      cacheControl: "no-store, max-age=0",
      contentType: publicSnapshots[0].contentType,
      pragma: "no-cache",
    }),
  );
});

test("scheduler failure returns a retryable account-independent response", async () => {
  const failures: Array<{ stage: string }> = [];
  let processCalls = 0;
  const handler = createPasswordResetRequestHandler({
    checkRateLimit: () => true,
    schedule() {
      throw new Error("after context unavailable");
    },
    async processRequest() {
      processCalls += 1;
    },
    reportFailure(failure) {
      failures.push(failure);
    },
  });

  const response = await handler(
    requestWithBody(JSON.stringify({ email: "kupac@example.com" })),
  );

  assert.equal(response.status, 503);
  assert.equal(
    await response.text(),
    JSON.stringify({ error: PASSWORD_RESET_UNAVAILABLE_MESSAGE }),
  );
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(processCalls, 0);
  assert.deepEqual(failures, [{ stage: "SCHEDULING" }]);
});

test("declared and streamed bodies above 1024 bytes are rejected before private work", async () => {
  const limiterCalls: string[] = [];
  const tasks: Array<() => Promise<void>> = [];
  const handler = createPasswordResetRequestHandler({
    checkRateLimit(key, limit) {
      limiterCalls.push(`${key}:${limit}`);
      return true;
    },
    schedule(task) {
      tasks.push(task);
    },
    async processRequest() {
      assert.fail("oversized bodies must not reach private work");
    },
    reportFailure() {},
  });

  const declaredResponse = await handler(
    requestWithBody("{}", {
      "content-length": String(MAX_PASSWORD_RESET_REQUEST_JSON_BYTES + 1),
    }),
  );

  assert.equal(declaredResponse.status, 413);
  assert.deepEqual(await declaredResponse.json(), {
    error: "Zahtev je prevelik.",
  });

  const serialized = JSON.stringify({ email: "kupac@example.com" });
  const oversizedSource = `${serialized}${" ".repeat(
    MAX_PASSWORD_RESET_REQUEST_JSON_BYTES + 1 -
      encoder.encode(serialized).byteLength,
  )}`;
  const oversizedBytes = encoder.encode(oversizedSource);
  assert.equal(
    oversizedBytes.byteLength,
    MAX_PASSWORD_RESET_REQUEST_JSON_BYTES + 1,
  );
  const streamed = streamedRequest(
    [
      oversizedBytes.subarray(0, MAX_PASSWORD_RESET_REQUEST_JSON_BYTES),
      oversizedBytes.subarray(MAX_PASSWORD_RESET_REQUEST_JSON_BYTES),
    ],
    { close: false },
  );
  const streamedResponse = await handler(streamed.request);

  assert.equal(streamedResponse.status, 413);
  assert.deepEqual(await streamedResponse.json(), {
    error: "Zahtev je prevelik.",
  });
  assert.equal(streamed.wasCancelled(), true);
  assert.deepEqual(limiterCalls, [
    "reset-request:203.0.113.10:3",
    "reset-request:203.0.113.10:3",
  ]);
  assert.deepEqual(tasks, []);
});

test("valid reset-request JSON is accepted at the exact 1024-byte boundary", async () => {
  const tasks: Array<() => Promise<void>> = [];
  const serialized = JSON.stringify({ email: "kupac@example.com" });
  const exactBody = `${serialized}${" ".repeat(
    MAX_PASSWORD_RESET_REQUEST_JSON_BYTES -
      encoder.encode(serialized).byteLength,
  )}`;
  assert.equal(
    encoder.encode(exactBody).byteLength,
    MAX_PASSWORD_RESET_REQUEST_JSON_BYTES,
  );
  const handler = createPasswordResetRequestHandler({
    checkRateLimit: () => true,
    schedule(task) {
      tasks.push(task);
    },
    async processRequest() {},
    reportFailure() {},
  });

  const response = await handler(requestWithBody(exactBody));

  assert.equal(response.status, 202);
  assert.equal(tasks.length, 1);
});

test("unsupported reset-request content metadata stops before private work", async () => {
  const tasks: Array<() => Promise<void>> = [];
  const handler = createPasswordResetRequestHandler({
    checkRateLimit: () => true,
    schedule(task) {
      tasks.push(task);
    },
    async processRequest() {},
    reportFailure() {},
  });

  for (const invalidRequest of [
    requestWithBody(JSON.stringify({ email: "kupac@example.com" }), {
      "content-type": "text/plain",
    }),
    requestWithBody(JSON.stringify({ email: "kupac@example.com" }), {
      "content-encoding": "gzip",
    }),
  ]) {
    const response = await handler(invalidRequest);
    assert.equal(response.status, 415);
    assert.deepEqual(await response.json(), {
      error: "Nepodržan format zahteva.",
    });
    assert.equal(
      response.headers.get("cache-control"),
      "no-store, max-age=0",
    );
  }

  assert.equal(tasks.length, 0);
});

test("malformed JSON, malformed UTF-8, non-exact body and invalid email are rejected without private work", async () => {
  const tasks: Array<() => Promise<void>> = [];
  const handler = createPasswordResetRequestHandler({
    checkRateLimit: () => true,
    schedule(task) {
      tasks.push(task);
    },
    async processRequest() {},
    reportFailure() {},
  });

  const malformedResponse = await handler(requestWithBody("{"));
  const malformedUtf8Response = await handler(
    streamedRequest([
      new Uint8Array([0x7b, 0x22, 0x80, 0x22, 0x7d]),
    ]).request,
  );
  const extraKeyResponse = await handler(
    requestWithBody(
      JSON.stringify({ email: "kupac@example.com", role: "ADMIN" }),
    ),
  );
  const arrayResponse = await handler(
    requestWithBody(JSON.stringify([{ email: "kupac@example.com" }])),
  );
  const invalidEmailResponse = await handler(
    requestWithBody(JSON.stringify({ email: "nije-email" })),
  );

  assert.equal(malformedResponse.status, 400);
  assert.equal(
    await malformedResponse.text(),
    JSON.stringify({ error: "Neispravan zahtev" }),
  );
  assert.equal(
    malformedResponse.headers.get("cache-control"),
    "no-store, max-age=0",
  );
  assert.equal(malformedResponse.headers.get("pragma"), "no-cache");
  assert.equal(malformedUtf8Response.status, 400);
  assert.equal(
    await malformedUtf8Response.text(),
    JSON.stringify({ error: "Neispravan zahtev" }),
  );
  assert.equal(extraKeyResponse.status, 400);
  assert.equal(
    await extraKeyResponse.text(),
    JSON.stringify({ error: "Neispravan zahtev" }),
  );
  assert.equal(arrayResponse.status, 400);
  assert.equal(
    await arrayResponse.text(),
    JSON.stringify({ error: "Neispravan zahtev" }),
  );
  assert.equal(invalidEmailResponse.status, 400);
  assert.equal(
    await invalidEmailResponse.text(),
    JSON.stringify({ error: "Neispravan format email adrese" }),
  );
  assert.equal(
    invalidEmailResponse.headers.get("cache-control"),
    "no-store, max-age=0",
  );
  assert.equal(invalidEmailResponse.headers.get("pragma"), "no-cache");
  assert.equal(tasks.length, 0);
});

test("rate limiting is account-independent and prevents scheduling", async () => {
  const tasks: Array<() => Promise<void>> = [];
  const limiterCalls: Array<{ key: string; limit: number }> = [];
  const limitedRequest = unreadableRequest({
    host: "example.test",
    origin: "https://example.test",
    "content-type": "application/json",
    "x-forwarded-for": "203.0.113.10",
  });
  const handler = createPasswordResetRequestHandler({
    checkRateLimit(key, limit) {
      limiterCalls.push({ key, limit });
      return false;
    },
    schedule(task) {
      tasks.push(task);
    },
    async processRequest() {},
    reportFailure() {},
  });

  const response = await handler(limitedRequest.request);

  assert.equal(response.status, 429);
  assert.equal(
    await response.text(),
    JSON.stringify({ error: "Previše pokušaja. Pokušajte ponovo za minut." }),
  );
  assert.equal(
    response.headers.get("cache-control"),
    "no-store, max-age=0",
  );
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.deepEqual(limiterCalls, [
    { key: "reset-request:203.0.113.10", limit: 3 },
  ]);
  assert.equal(limitedRequest.bodyReadCount(), 0);
  assert.equal(tasks.length, 0);
});

test("rate limiter failure is coarse, private and stops before body parsing", async () => {
  const failures: Array<{ stage: string }> = [];
  const guarded = unreadableRequest({
    host: "example.test",
    origin: "https://example.test",
    "content-type": "application/json",
    "x-forwarded-for": "203.0.113.10",
  });
  const handler = createPasswordResetRequestHandler({
    checkRateLimit() {
      throw new Error("shared limiter connection included secret");
    },
    schedule() {
      assert.fail("limiter failure must stop scheduling");
    },
    async processRequest() {
      assert.fail("limiter failure must stop private work");
    },
    reportFailure(failure) {
      failures.push(failure);
      throw new Error("reporter unavailable");
    },
  });

  const response = await handler(guarded.request);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: PASSWORD_RESET_UNAVAILABLE_MESSAGE,
  });
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(guarded.bodyReadCount(), 0);
  assert.deepEqual(failures, [{ stage: "RATE_LIMIT" }]);
});
