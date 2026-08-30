import assert from "node:assert/strict";
import test from "node:test";
import { hashCredentialToken } from "./credential-token";
import {
  PASSWORD_RESET_ACCEPTED_MESSAGE,
  PASSWORD_RESET_TOKEN_LIFETIME_MS,
  PASSWORD_RESET_UNAVAILABLE_MESSAGE,
  PasswordResetRequestConflictError,
  acceptPasswordResetRequest,
  createPrismaPasswordResetRequestDatabase,
  normalizePasswordResetEmail,
  processPasswordResetRequest,
  replacePasswordResetTokenForRequest,
  type PasswordResetFailure,
  type PasswordResetLockedUser,
  type PasswordResetRequestDatabase,
  type PasswordResetRequestDependencies,
  type PasswordResetTokenWrite,
} from "./password-reset-request";

const USER = {
  id: "user-1",
  email: "kupac@example.com",
  role: "CUSTOMER" as const,
  rowVersion: "101",
};
const RECIPIENT = { email: USER.email, firstName: "Kupac" };
const TOKEN = "a".repeat(64);
const TOKEN_HASH = hashCredentialToken("password-reset", TOKEN);
assert.ok(TOKEN_HASH);
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
    hashToken(token) {
      calls.push("hash-token");
      return token === TOKEN ? TOKEN_HASH : null;
    },
    async replaceTokensForRequest(input) {
      calls.push(
        `replace:${input.expectedUser.id}:${input.expectedUser.email}:${input.expectedUser.role}:${input.expectedUser.rowVersion}:${input.legacyPlaintextToken}:${input.tokenHash}`,
      );
      return RECIPIENT;
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

interface ReplacementHarness {
  database: PasswordResetRequestDatabase;
  events: string[];
  writes: PasswordResetTokenWrite[];
}

function createReplacementHarness(
  lockedUser: PasswordResetLockedUser | null = {
    ...USER,
    firstName: RECIPIENT.firstName,
  },
): ReplacementHarness {
  const events: string[] = [];
  const writes: PasswordResetTokenWrite[] = [];
  const database: PasswordResetRequestDatabase = {
    async transaction(work) {
      events.push("transaction:start");
      try {
        const result = await work({
          async lockUserById(userId) {
            events.push(`lock-user:${userId}`);
            return lockedUser;
          },
          async readDatabaseTime() {
            events.push("clock");
            return NOW;
          },
          async replacePasswordReset(input) {
            events.push("replace-password-reset");
            writes.push(input);
          },
        });
        events.push("transaction:commit");
        return result;
      } catch (error) {
        events.push("transaction:rollback");
        throw error;
      }
    },
  };

  return { database, events, writes };
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
    "hash-token",
    `replace:${USER.id}:${USER.email}:${USER.role}:${USER.rowVersion}:${TOKEN}:${TOKEN_HASH}`,
    `send:${RECIPIENT.email}:${RECIPIENT.firstName}:${TOKEN}`,
  ]);
});

test("replacement locks User, then reads DB time and writes PasswordReset", async () => {
  const harness = createReplacementHarness();

  const recipient = await replacePasswordResetTokenForRequest(
    harness.database,
    {
      expectedUser: USER,
      legacyPlaintextToken: TOKEN,
      tokenHash: TOKEN_HASH,
    },
  );

  assert.deepEqual(recipient, RECIPIENT);
  assert.deepEqual(harness.events, [
    "transaction:start",
    `lock-user:${USER.id}`,
    "clock",
    "replace-password-reset",
    "transaction:commit",
  ]);
  assert.deepEqual(harness.writes, [
    {
      userId: USER.id,
      legacyPlaintextToken: TOKEN,
      tokenHash: TOKEN_HASH,
      expires: new Date(
        NOW.getTime() + PASSWORD_RESET_TOKEN_LIFETIME_MS,
      ),
    },
  ]);
});

test("stale email, role or tuple revision rolls back before clock and token", async () => {
  const staleLockedUsers: PasswordResetLockedUser[] = [
    { ...USER, email: "changed@example.com", firstName: "Changed" },
    { ...USER, role: "ADMIN", firstName: "Promoted" },
    { ...USER, rowVersion: "102", firstName: "Updated" },
  ];

  for (const lockedUser of staleLockedUsers) {
    const harness = createReplacementHarness(lockedUser);
    await assert.rejects(
      replacePasswordResetTokenForRequest(harness.database, {
        expectedUser: USER,
        legacyPlaintextToken: TOKEN,
        tokenHash: TOKEN_HASH,
      }),
      PasswordResetRequestConflictError,
    );
    assert.deepEqual(harness.events, [
      "transaction:start",
      `lock-user:${USER.id}`,
      "transaction:rollback",
    ]);
    assert.deepEqual(harness.writes, []);
  }
});

test("invalid DB clock rolls back without creating a reset credential", async () => {
  const harness = createReplacementHarness();
  harness.database.transaction = async (work) =>
    work({
      async lockUserById() {
        harness.events.push("lock-user");
        return { ...USER, firstName: RECIPIENT.firstName };
      },
      async readDatabaseTime() {
        harness.events.push("clock");
        return new Date(Number.NaN);
      },
      async replacePasswordReset(input) {
        harness.writes.push(input);
      },
    });

  await assert.rejects(
    replacePasswordResetTokenForRequest(harness.database, {
      expectedUser: USER,
      legacyPlaintextToken: TOKEN,
      tokenHash: TOKEN_HASH,
    }),
    PasswordResetRequestConflictError,
  );
  assert.deepEqual(harness.events, ["lock-user", "clock"]);
  assert.deepEqual(harness.writes, []);
});

test("Prisma adapter binds lookup, locks User first and uses clock_timestamp", async () => {
  const events: string[] = [];
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const upserts: unknown[] = [];
  const rawUser = {
    ...USER,
    firstName: RECIPIENT.firstName,
  };

  const transaction = {
    async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      const sql = strings.join("?");
      queries.push({ sql, values });
      if (sql.includes("FOR UPDATE")) {
        events.push("query:user-for-update");
        return [rawUser];
      }
      if (sql.includes("clock_timestamp()")) {
        events.push("query:clock");
        return [{ currentTimestamp: NOW }];
      }
      throw new Error("unexpected transaction query");
    },
    passwordReset: {
      async upsert(input: unknown) {
        events.push("prisma:upsert-password-reset");
        upserts.push(input);
        return { id: "private-reset-id" };
      },
    },
  };
  const client = {
    async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      const sql = strings.join("?");
      events.push("query:user-by-email");
      queries.push({ sql, values });
      return [USER];
    },
    async $transaction(
      work: (value: typeof transaction) => Promise<unknown>,
    ) {
      events.push("prisma:transaction:start");
      const result = await work(transaction);
      events.push("prisma:transaction:commit");
      return result;
    },
  } as unknown as Parameters<
    typeof createPrismaPasswordResetRequestDatabase
  >[0];
  const adapter = createPrismaPasswordResetRequestDatabase(client);

  const snapshot = await adapter.findUserByEmail(USER.email);
  assert.deepEqual(snapshot, USER);
  const recipient = await adapter.replaceTokensForRequest({
    expectedUser: snapshot,
    legacyPlaintextToken: TOKEN,
    tokenHash: TOKEN_HASH,
  });

  assert.deepEqual(recipient, RECIPIENT);
  assert.deepEqual(events, [
    "query:user-by-email",
    "prisma:transaction:start",
    "query:user-for-update",
    "query:clock",
    "prisma:upsert-password-reset",
    "prisma:transaction:commit",
  ]);
  assert.match(queries[0]?.sql ?? "", /xmin::text/);
  assert.equal(queries[0]?.sql.includes(USER.email), false);
  assert.deepEqual(queries[0]?.values, [USER.email]);
  assert.match(queries[1]?.sql ?? "", /FOR UPDATE/);
  assert.match(queries[1]?.sql ?? "", /xmin::text/);
  assert.equal(queries[1]?.sql.includes(USER.id), false);
  assert.deepEqual(queries[1]?.values, [USER.id]);
  assert.match(
    queries[2]?.sql ?? "",
    /clock_timestamp\(\)::timestamptz\(3\)/,
  );
  assert.deepEqual(upserts, [
    {
      where: { userId: USER.id },
      create: {
        userId: USER.id,
        token: TOKEN,
        tokenHash: TOKEN_HASH,
        expires: new Date(
          NOW.getTime() + PASSWORD_RESET_TOKEN_LIFETIME_MS,
        ),
      },
      update: {
        token: TOKEN,
        tokenHash: TOKEN_HASH,
        expires: new Date(
          NOW.getTime() + PASSWORD_RESET_TOKEN_LIFETIME_MS,
        ),
      },
    },
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

test("invalid generated credential stops before persistence and delivery", async () => {
  const harness = createHarness();
  harness.dependencies.generateToken = () => "not-a-token";
  harness.dependencies.hashToken = () => null;

  await processPasswordResetRequest(USER.email, harness.dependencies);

  assert.deepEqual(harness.failures, [{ stage: "TOKEN_REPLACEMENT" }]);
  assert.equal(harness.calls.some((call) => call.startsWith("replace:")), false);
  assert.equal(harness.calls.some((call) => call.startsWith("send:")), false);
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
