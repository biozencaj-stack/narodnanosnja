import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSWORD_RESET_ACCEPTED_MESSAGE,
  PASSWORD_RESET_TOKEN_LIFETIME_MS,
  PASSWORD_RESET_UNAVAILABLE_MESSAGE,
  acceptPasswordResetRequest,
  normalizePasswordResetEmail,
  processPasswordResetRequest,
  type PasswordResetFailure,
  type PasswordResetRequestDependencies,
} from "./password-reset-request";

const USER = {
  id: "user-1",
  email: "kupac@example.com",
  firstName: "Kupac",
};
const TOKEN = "a".repeat(64);
const NOW = new Date("2026-08-30T10:30:00.000Z");
const ACCEPTED_RESPONSE = {
  status: 202,
  body: { message: PASSWORD_RESET_ACCEPTED_MESSAGE },
};
const UNAVAILABLE_RESPONSE = {
  status: 503,
  body: { error: PASSWORD_RESET_UNAVAILABLE_MESSAGE },
};

interface Harness {
  dependencies: PasswordResetRequestDependencies;
  calls: string[];
  failures: PasswordResetFailure[];
}

function createHarness(): Harness {
  const calls: string[] = [];
  const failures: PasswordResetFailure[] = [];
  const dependencies: PasswordResetRequestDependencies = {
    async findUserByEmail(email) {
      calls.push(`lookup:${email}`);
      return USER;
    },
    generateToken() {
      calls.push("generate-token");
      return TOKEN;
    },
    now() {
      return NOW;
    },
    async replaceTokensForRequest(input) {
      calls.push(
        `replace:${input.userId}:${input.token}:${input.expires.toISOString()}`,
      );
    },
    async sendResetEmail(email, firstName, token) {
      calls.push(`send:${email}:${firstName}:${token}`);
    },
    reportFailure(failure) {
      failures.push(failure);
    },
  };

  return { dependencies, calls, failures };
}

test("password reset email normalization rejects malformed public input", () => {
  assert.equal(normalizePasswordResetEmail(undefined), null);
  assert.equal(normalizePasswordResetEmail({}), null);
  assert.equal(normalizePasswordResetEmail(""), null);
  assert.equal(normalizePasswordResetEmail("nema-at-znak.example.com"), null);
  assert.equal(normalizePasswordResetEmail("a".repeat(255)), null);
  assert.equal(
    normalizePasswordResetEmail("  KUPAC@EXAMPLE.COM  "),
    "kupac@example.com",
  );
});

test("absent account stops after lookup without token or SMTP work", async () => {
  const harness = createHarness();
  harness.dependencies.findUserByEmail = async (email) => {
    harness.calls.push(`lookup:${email}`);
    return null;
  };

  await processPasswordResetRequest("nema@example.com", harness.dependencies);

  assert.deepEqual(harness.calls, ["lookup:nema@example.com"]);
  assert.deepEqual(harness.failures, []);
});

test("successful private reset work replaces the token before SMTP", async () => {
  const harness = createHarness();

  await processPasswordResetRequest(USER.email, harness.dependencies);

  assert.deepEqual(harness.failures, []);
  assert.deepEqual(harness.calls, [
    `lookup:${USER.email}`,
    "generate-token",
    `replace:${USER.id}:${TOKEN}:${new Date(
      NOW.getTime() + PASSWORD_RESET_TOKEN_LIFETIME_MS,
    ).toISOString()}`,
    `send:${USER.email}:${USER.firstName}:${TOKEN}`,
  ]);
});

test("SMTP failure is stage-only and keeps the possibly delivered token valid", async () => {
  const privateFailure = `SMTP rejected ${USER.email} token ${TOKEN}`;
  const harness = createHarness();
  harness.dependencies.sendResetEmail = async () => {
    throw new Error(privateFailure);
  };

  await processPasswordResetRequest(USER.email, harness.dependencies);

  assert.deepEqual(harness.failures, [{ stage: "DELIVERY" }]);
  assert.equal(JSON.stringify(harness.failures).includes(USER.email), false);
  assert.equal(JSON.stringify(harness.failures).includes(TOKEN), false);
  assert.equal(JSON.stringify(harness.failures).includes(privateFailure), false);
  assert.ok(harness.calls.some((call) => call.startsWith("replace:")));
});

test("lookup and token failures stop safely before downstream work", async () => {
  const lookupFailure = createHarness();
  lookupFailure.dependencies.findUserByEmail = async () => {
    throw new Error(`database lookup failed for ${USER.email}`);
  };
  const tokenFailure = createHarness();
  tokenFailure.dependencies.replaceTokensForRequest = async () => {
    throw new Error(`token write failed for ${TOKEN}`);
  };

  await Promise.all([
    processPasswordResetRequest(USER.email, lookupFailure.dependencies),
    processPasswordResetRequest(USER.email, tokenFailure.dependencies),
  ]);

  assert.deepEqual(lookupFailure.failures, [{ stage: "LOOKUP" }]);
  assert.deepEqual(tokenFailure.failures, [{ stage: "TOKEN_REPLACEMENT" }]);
  assert.equal(lookupFailure.calls.some((call) => call.startsWith("send:")), false);
  assert.equal(tokenFailure.calls.some((call) => call.startsWith("send:")), false);
});

test("accepted response is returned before account-dependent work starts", async () => {
  const failures: PasswordResetFailure[] = [];
  let scheduledTask: (() => Promise<void>) | undefined;
  let workStarted = false;

  const response = acceptPasswordResetRequest({
    schedule(task) {
      scheduledTask = task;
    },
    async work() {
      workStarted = true;
    },
    reportFailure(failure) {
      failures.push(failure);
    },
  });

  assert.deepEqual(response, ACCEPTED_RESPONSE);
  assert.equal(workStarted, false);
  assert.ok(scheduledTask);

  await scheduledTask();
  assert.equal(workStarted, true);
  assert.deepEqual(failures, []);
});

test("scheduler failure is retryable while background failures stay private", async () => {
  const schedulingFailures: PasswordResetFailure[] = [];
  const schedulingResponse = acceptPasswordResetRequest({
    schedule() {
      throw new Error("scheduler unavailable");
    },
    async work() {
      throw new Error("must not run");
    },
    reportFailure(failure) {
      schedulingFailures.push(failure);
    },
  });

  let backgroundTask: (() => Promise<void>) | undefined;
  const backgroundFailures: PasswordResetFailure[] = [];
  const backgroundResponse = acceptPasswordResetRequest({
    schedule(task) {
      backgroundTask = task;
    },
    async work() {
      throw new Error(`private failure for ${USER.email}`);
    },
    reportFailure(failure) {
      backgroundFailures.push(failure);
      throw new Error("logger failed");
    },
  });

  assert.deepEqual(schedulingResponse, UNAVAILABLE_RESPONSE);
  assert.deepEqual(schedulingFailures, [{ stage: "SCHEDULING" }]);
  assert.deepEqual(backgroundResponse, ACCEPTED_RESPONSE);
  assert.ok(backgroundTask);

  await backgroundTask();
  assert.deepEqual(backgroundFailures, [{ stage: "BACKGROUND" }]);
});
