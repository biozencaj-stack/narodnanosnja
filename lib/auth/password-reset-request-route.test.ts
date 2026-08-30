import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import {
  PASSWORD_RESET_ACCEPTED_MESSAGE,
  PASSWORD_RESET_UNAVAILABLE_MESSAGE,
} from "./password-reset-request";
import { createPasswordResetRequestHandler } from "./password-reset-request-route";

const ENDPOINT = "https://example.test/api/auth/reset-password/request";
const ACCEPTED_TEXT = JSON.stringify({
  message: PASSWORD_RESET_ACCEPTED_MESSAGE,
});

function requestWithBody(body: string): NextRequest {
  return new NextRequest(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.10",
    },
    body,
  });
}

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

test("malformed JSON and invalid email are rejected without scheduling work", async () => {
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

  const response = await handler(
    requestWithBody(JSON.stringify({ email: "bilo-ko@example.com" })),
  );

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
  assert.equal(tasks.length, 0);
});
