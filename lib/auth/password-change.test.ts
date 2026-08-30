import assert from "node:assert/strict";
import test from "node:test";
import {
  PasswordChangeError,
  changeAuthenticatedPassword,
  createPrismaPasswordChangeDatabase,
  type PasswordChangeCrypto,
  type PasswordChangeDatabase,
  type PasswordChangeTransaction,
} from "./password-change";

const USER_ID = "private-user-id";
const CURRENT_PASSWORD = "Trenutna1!";
const NEW_PASSWORD = "NovaLozinka2!";
const CURRENT_HASH = `$2a$12$${"a".repeat(53)}`;
const CHANGED_HASH = `$2b$12$${"b".repeat(53)}`;
const CONCURRENT_HASH = `$2a$12$${"c".repeat(53)}`;

interface Harness {
  database: PasswordChangeDatabase;
  crypto: PasswordChangeCrypto;
  events: string[];
  updates: Array<{
    userId: string;
    expectedPasswordHash: string;
    newPasswordHash: string;
  }>;
  transaction: PasswordChangeTransaction;
}

function createHarness(options: {
  credentialHash?: string | null;
  lockedHash?: string | null;
  compareResult?: boolean;
} = {}): Harness {
  const events: string[] = [];
  const updates: Harness["updates"] = [];
  const credentialHash =
    options.credentialHash === undefined
      ? CURRENT_HASH
      : options.credentialHash;
  const lockedHash =
    options.lockedHash === undefined ? CURRENT_HASH : options.lockedHash;

  const transaction: PasswordChangeTransaction = {
    async lockUserById(userId) {
      events.push(`lock-user:${userId}`);
      return lockedHash === null
        ? null
        : { id: USER_ID, passwordHash: lockedHash };
    },
    async updatePasswordHash(input) {
      events.push("update-password");
      updates.push(input);
      return true;
    },
    async deleteSessions(userId) {
      events.push(`delete-sessions:${userId}`);
    },
    async deletePasswordResets(userId) {
      events.push(`delete-password-resets:${userId}`);
    },
    async deleteEmailVerifications(userId) {
      events.push(`delete-email-verifications:${userId}`);
    },
  };
  const database: PasswordChangeDatabase = {
    async findCredentialById(userId) {
      events.push(`lookup:${userId}`);
      return credentialHash === null
        ? null
        : { id: USER_ID, passwordHash: credentialHash };
    },
    async transaction(work) {
      events.push("transaction:start");
      try {
        const result = await work(transaction);
        events.push("transaction:commit");
        return result;
      } catch (error) {
        events.push("transaction:rollback");
        throw error;
      }
    },
  };
  const crypto: PasswordChangeCrypto = {
    async compareCurrentPassword(password, passwordHash) {
      events.push(`compare:${password}:${passwordHash}`);
      return options.compareResult ?? true;
    },
    async hashNewPassword(password) {
      events.push(`hash:${password}`);
      return CHANGED_HASH;
    },
  };

  return { database, crypto, events, updates, transaction };
}

function changeWithHarness(harness: Harness) {
  return changeAuthenticatedPassword(
    {
      userId: USER_ID,
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
    },
    harness.database,
    harness.crypto,
  );
}

test("successful change compares before a User-first atomic cleanup", async () => {
  const harness = createHarness();

  const result = await changeWithHarness(harness);

  assert.deepEqual(result, { kind: "changed" });
  assert.deepEqual(Object.keys(result), ["kind"]);
  assert.deepEqual(harness.events, [
    `lookup:${USER_ID}`,
    `compare:${CURRENT_PASSWORD}:${CURRENT_HASH}`,
    `hash:${NEW_PASSWORD}`,
    "transaction:start",
    `lock-user:${USER_ID}`,
    "update-password",
    `delete-sessions:${USER_ID}`,
    `delete-password-resets:${USER_ID}`,
    `delete-email-verifications:${USER_ID}`,
    "transaction:commit",
  ]);
  assert.deepEqual(harness.updates, [
    {
      userId: USER_ID,
      expectedPasswordHash: CURRENT_HASH,
      newPasswordHash: CHANGED_HASH,
    },
  ]);
});

test("missing user and wrong current password stop before hash or transaction", async () => {
  const missing = createHarness({ credentialHash: null });
  const wrong = createHarness({ compareResult: false });

  assert.deepEqual(await changeWithHarness(missing), {
    kind: "invalid-current-password",
  });
  assert.deepEqual(await changeWithHarness(wrong), {
    kind: "invalid-current-password",
  });
  assert.deepEqual(missing.events, [`lookup:${USER_ID}`]);
  assert.deepEqual(wrong.events, [
    `lookup:${USER_ID}`,
    `compare:${CURRENT_PASSWORD}:${CURRENT_HASH}`,
  ]);
});

test("password mutation after bcrypt is a generic stale result with no cleanup", async () => {
  const stale = createHarness({ lockedHash: CONCURRENT_HASH });

  const result = await changeWithHarness(stale);

  assert.deepEqual(result, { kind: "invalid-current-password" });
  assert.deepEqual(stale.events, [
    `lookup:${USER_ID}`,
    `compare:${CURRENT_PASSWORD}:${CURRENT_HASH}`,
    `hash:${NEW_PASSWORD}`,
    "transaction:start",
    `lock-user:${USER_ID}`,
    "transaction:commit",
  ]);
  assert.deepEqual(stale.updates, []);
});

test("deleted user after bcrypt is the same generic stale result", async () => {
  const deleted = createHarness({ lockedHash: null });

  assert.deepEqual(await changeWithHarness(deleted), {
    kind: "invalid-current-password",
  });
  assert.equal(
    deleted.events.some((event) => event.startsWith("delete-")),
    false,
  );
  assert.deepEqual(deleted.updates, []);
});

test("failed conditional update rolls back before credential cleanup", async () => {
  const harness = createHarness();
  harness.transaction.updatePasswordHash = async () => {
    harness.events.push("update-password");
    return false;
  };

  await assert.rejects(
    changeWithHarness(harness),
    (error) =>
      error instanceof PasswordChangeError &&
      error.stage === "COMMIT" &&
      !error.message.includes(USER_ID) &&
      !error.message.includes(CURRENT_HASH),
  );
  assert.deepEqual(harness.events.slice(-4), [
    "transaction:start",
    `lock-user:${USER_ID}`,
    "update-password",
    "transaction:rollback",
  ]);
  assert.equal(
    harness.events.some((event) => event.startsWith("delete-")),
    false,
  );
});

test("token cleanup failure rolls the password write back and stays coarse", async () => {
  const privateFailure = `reset cleanup failed for ${USER_ID}`;
  const harness = createHarness();
  harness.transaction.deletePasswordResets = async () => {
    harness.events.push(`delete-password-resets:${USER_ID}`);
    throw new Error(privateFailure);
  };

  await assert.rejects(
    changeWithHarness(harness),
    (error) =>
      error instanceof PasswordChangeError &&
      error.stage === "COMMIT" &&
      !error.message.includes(privateFailure),
  );
  assert.deepEqual(harness.events.slice(-6), [
    "transaction:start",
    `lock-user:${USER_ID}`,
    "update-password",
    `delete-sessions:${USER_ID}`,
    `delete-password-resets:${USER_ID}`,
    "transaction:rollback",
  ]);
  assert.equal(
    harness.events.includes(`delete-email-verifications:${USER_ID}`),
    false,
  );
});

test("session cleanup failure rolls back the password/revision write and skips credential cleanup", async () => {
  const privateFailure = `session cleanup failed for ${USER_ID}`;
  const harness = createHarness();
  harness.transaction.deleteSessions = async () => {
    harness.events.push(`delete-sessions:${USER_ID}`);
    throw new Error(privateFailure);
  };

  await assert.rejects(
    changeWithHarness(harness),
    (error) =>
      error instanceof PasswordChangeError &&
      error.stage === "COMMIT" &&
      !error.message.includes(privateFailure),
  );
  assert.deepEqual(harness.events.slice(-5), [
    "transaction:start",
    `lock-user:${USER_ID}`,
    "update-password",
    `delete-sessions:${USER_ID}`,
    "transaction:rollback",
  ]);
  assert.equal(
    harness.events.includes(`delete-password-resets:${USER_ID}`),
    false,
  );
  assert.equal(
    harness.events.includes(`delete-email-verifications:${USER_ID}`),
    false,
  );
});

test("lookup, bcrypt and hashing failures expose only a coarse stage", async () => {
  const cases: Array<{
    stage: "LOOKUP" | "VERIFY" | "HASH";
    configure: (harness: Harness) => void;
  }> = [
    {
      stage: "LOOKUP",
      configure(harness) {
        harness.database.findCredentialById = async () => {
          throw new Error(`lookup leaked ${USER_ID}`);
        };
      },
    },
    {
      stage: "VERIFY",
      configure(harness) {
        harness.crypto.compareCurrentPassword = async () => {
          throw new Error(`bcrypt leaked ${CURRENT_PASSWORD}`);
        };
      },
    },
    {
      stage: "HASH",
      configure(harness) {
        harness.crypto.hashNewPassword = async () => {
          throw new Error(`hash leaked ${NEW_PASSWORD}`);
        };
      },
    },
  ];

  for (const testCase of cases) {
    const harness = createHarness();
    testCase.configure(harness);
    await assert.rejects(
      changeWithHarness(harness),
      (error) =>
        error instanceof PasswordChangeError &&
        error.stage === testCase.stage &&
        !error.message.includes(USER_ID) &&
        !error.message.includes(CURRENT_PASSWORD) &&
        !error.message.includes(NEW_PASSWORD),
    );
  }
});

test("invalid prepared input stops before credential lookup", async () => {
  const harness = createHarness();

  await assert.rejects(
    changeAuthenticatedPassword(
      {
        userId: "",
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      },
      harness.database,
      harness.crypto,
    ),
    (error) =>
      error instanceof PasswordChangeError && error.stage === "INPUT",
  );
  assert.deepEqual(harness.events, []);
});

test("Prisma adapter binds User lock, advances revision and revokes sessions after CAS update", async () => {
  const events: string[] = [];
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const lookups: unknown[] = [];
  const updates: unknown[] = [];
  const sessionDeletes: unknown[] = [];
  const resetDeletes: unknown[] = [];
  const verificationDeletes: unknown[] = [];

  const transaction = {
    async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      events.push("query:user-for-update");
      queries.push({ sql: strings.join("?"), values });
      return [{ id: USER_ID, passwordHash: CURRENT_HASH }];
    },
    user: {
      async updateMany(input: unknown) {
        events.push("prisma:update-password");
        updates.push(input);
        return { count: 1 };
      },
    },
    session: {
      async deleteMany(input: unknown) {
        events.push("prisma:delete-sessions");
        sessionDeletes.push(input);
        return { count: 4 };
      },
    },
    passwordReset: {
      async deleteMany(input: unknown) {
        events.push("prisma:delete-password-resets");
        resetDeletes.push(input);
        return { count: 2 };
      },
    },
    emailVerification: {
      async deleteMany(input: unknown) {
        events.push("prisma:delete-email-verifications");
        verificationDeletes.push(input);
        return { count: 3 };
      },
    },
  };
  const client = {
    user: {
      async findUnique(input: unknown) {
        events.push("prisma:lookup-credential");
        lookups.push(input);
        return { id: USER_ID, passwordHash: CURRENT_HASH };
      },
    },
    async $transaction(
      work: (value: typeof transaction) => Promise<unknown>,
    ) {
      events.push("prisma:transaction:start");
      const result = await work(transaction);
      events.push("prisma:transaction:commit");
      return result;
    },
  } as unknown as Parameters<typeof createPrismaPasswordChangeDatabase>[0];
  const database = createPrismaPasswordChangeDatabase(client);
  const crypto: PasswordChangeCrypto = {
    async compareCurrentPassword() {
      events.push("bcrypt:compare");
      return true;
    },
    async hashNewPassword() {
      events.push("bcrypt:hash");
      return CHANGED_HASH;
    },
  };

  assert.deepEqual(
    await changeAuthenticatedPassword(
      {
        userId: USER_ID,
        currentPassword: CURRENT_PASSWORD,
        newPassword: NEW_PASSWORD,
      },
      database,
      crypto,
    ),
    { kind: "changed" },
  );
  assert.deepEqual(events, [
    "prisma:lookup-credential",
    "bcrypt:compare",
    "bcrypt:hash",
    "prisma:transaction:start",
    "query:user-for-update",
    "prisma:update-password",
    "prisma:delete-sessions",
    "prisma:delete-password-resets",
    "prisma:delete-email-verifications",
    "prisma:transaction:commit",
  ]);
  assert.deepEqual(lookups, [
    {
      where: { id: USER_ID },
      select: { id: true, passwordHash: true },
    },
  ]);
  assert.match(queries[0]?.sql ?? "", /FROM public\."User"/);
  assert.match(queries[0]?.sql ?? "", /FOR UPDATE/);
  assert.equal(queries[0]?.sql.includes(USER_ID), false);
  assert.deepEqual(queries[0]?.values, [USER_ID]);
  assert.deepEqual(updates, [
    {
      where: { id: USER_ID, passwordHash: CURRENT_HASH },
      data: {
        passwordHash: CHANGED_HASH,
        authSessionRevision: { increment: 1 },
      },
    },
  ]);
  assert.deepEqual(sessionDeletes, [{ where: { userId: USER_ID } }]);
  assert.deepEqual(resetDeletes, [{ where: { userId: USER_ID } }]);
  assert.deepEqual(verificationDeletes, [
    { where: { userId: USER_ID } },
  ]);
});
