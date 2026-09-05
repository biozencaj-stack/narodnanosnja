import assert from "node:assert/strict";
import test from "node:test";
import {
  PrivilegedAccountError,
  createPrismaPrivilegedAccountDatabase,
  provisionPrivilegedAccount,
  type PrivilegedAccountCreateWrite,
  type PrivilegedAccountDatabase,
  type PrivilegedAccountSecurityWrite,
  type PrivilegedAccountTransaction,
} from "./privileged-account";
import { evaluateVerifiedLoginPolicy } from "./verified-login-policy";

const DATABASE_TIME = new Date("2026-08-30T16:20:30.456Z");
const PASSWORD_HASH = `$2b$12$${"a".repeat(53)}`;
const INPUT = {
  email: "  PRIVILEGED@Example.com ",
  passwordHash: PASSWORD_HASH,
  role: "ADMIN",
  updateExisting: false,
} as const;

function createHarness(existingUserId: string | null = null) {
  const events: string[] = [];
  const creates: PrivilegedAccountCreateWrite[] = [];
  const updates: Array<{
    userId: string;
    input: PrivilegedAccountSecurityWrite;
  }> = [];
  const deletedVerificationUserIds: string[] = [];
  const deletedPasswordResetUserIds: string[] = [];
  const revokedSessionUserIds: string[] = [];

  const transaction: PrivilegedAccountTransaction = {
    async lockUserByEmail(normalizedEmail) {
      events.push(`lock:${normalizedEmail}`);
      return existingUserId ? { id: existingUserId } : null;
    },
    async readDatabaseTime() {
      events.push("clock");
      return DATABASE_TIME;
    },
    async createUser(input) {
      events.push("create-user");
      creates.push(input);
      return { id: "private-created-user-id" };
    },
    async updateUser(userId, input) {
      events.push("update-user");
      updates.push({ userId, input });
      return true;
    },
    async bumpAuthSessionRevisionAndRevokeSessions(userId) {
      events.push("bump-session-revision-and-revoke");
      revokedSessionUserIds.push(userId);
      return true;
    },
    async deleteEmailVerifications(userId) {
      events.push("delete-email-verifications");
      deletedVerificationUserIds.push(userId);
    },
    async deletePasswordResets(userId) {
      events.push("delete-password-resets");
      deletedPasswordResetUserIds.push(userId);
    },
  };

  const database: PrivilegedAccountDatabase = {
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

  return {
    creates,
    database,
    deletedPasswordResetUserIds,
    deletedVerificationUserIds,
    events,
    revokedSessionUserIds,
    transaction,
    updates,
  };
}

function expectedSecurityWrite(
  role: "ADMIN" | "OPERATOR" = "ADMIN",
): PrivilegedAccountSecurityWrite {
  return {
    passwordHash: PASSWORD_HASH,
    role,
    emailVerified: DATABASE_TIME,
    emailVerificationLoginGraceUntil: null,
    verificationEmailNextAllowedAt: null,
    verificationEmailResendWindowStartedAt: null,
    verificationEmailResendCount: null,
  };
}

test("creates a normalized, verified privileged account atomically", async () => {
  const harness = createHarness();

  const result = await provisionPrivilegedAccount(INPUT, harness.database);

  assert.deepEqual(result, { kind: "created" });
  assert.deepEqual(Object.keys(result), ["kind"]);
  assert.equal(JSON.stringify(result).includes("example.com"), false);
  assert.equal(JSON.stringify(result).includes("private-created-user-id"), false);
  assert.deepEqual(harness.events, [
    "transaction:start",
    "lock:privileged@example.com",
    "clock",
    "create-user",
    "delete-email-verifications",
    "delete-password-resets",
    "transaction:commit",
  ]);
  assert.deepEqual(harness.creates, [
    {
      email: "privileged@example.com",
      firstName: "Admin",
      lastName: "[COMPANY_NAME]",
      // Isti trenutak kao `emailVerified`: nalog se pravi i verifikuje u istoj
      // transakciji, pa je jedan isti sat jedini tačan opis.
      createdAt: DATABASE_TIME,
      ...expectedSecurityWrite(),
    },
  ]);
  assert.deepEqual(harness.deletedVerificationUserIds, [
    "private-created-user-id",
  ]);
  assert.deepEqual(harness.deletedPasswordResetUserIds, [
    "private-created-user-id",
  ]);
});

test("an existing account without the explicit update flag is a no-op", async () => {
  const harness = createHarness("private-existing-user-id");

  const result = await provisionPrivilegedAccount(INPUT, harness.database);

  assert.deepEqual(result, { kind: "exists" });
  assert.deepEqual(Object.keys(result), ["kind"]);
  assert.deepEqual(harness.events, [
    "transaction:start",
    "lock:privileged@example.com",
    "transaction:commit",
  ]);
  assert.deepEqual(harness.creates, []);
  assert.deepEqual(harness.updates, []);
  assert.deepEqual(harness.deletedVerificationUserIds, []);
  assert.deepEqual(harness.deletedPasswordResetUserIds, []);
});

test("explicit update verifies and resets verification state in one transaction", async () => {
  const harness = createHarness("private-existing-user-id");

  const result = await provisionPrivilegedAccount(
    {
      ...INPUT,
      role: "OPERATOR",
      updateExisting: true,
    },
    harness.database,
  );

  assert.deepEqual(result, { kind: "updated" });
  assert.deepEqual(Object.keys(result), ["kind"]);
  assert.deepEqual(harness.events, [
    "transaction:start",
    "lock:privileged@example.com",
    "clock",
    "update-user",
    "bump-session-revision-and-revoke",
    "delete-email-verifications",
    "delete-password-resets",
    "transaction:commit",
  ]);
  assert.deepEqual(harness.updates, [
    {
      userId: "private-existing-user-id",
      input: expectedSecurityWrite("OPERATOR"),
    },
  ]);
  assert.deepEqual(harness.deletedVerificationUserIds, [
    "private-existing-user-id",
  ]);
  assert.deepEqual(harness.revokedSessionUserIds, [
    "private-existing-user-id",
  ]);
  assert.deepEqual(harness.deletedPasswordResetUserIds, [
    "private-existing-user-id",
  ]);
});

test("invalid public input fails closed before opening a transaction", async () => {
  const invalidInputs = [
    { ...INPUT, email: "Display Name <admin@example.com>" },
    { ...INPUT, email: "admin@example" },
    { ...INPUT, role: "CUSTOMER" },
    { ...INPUT, role: "admin" },
    { ...INPUT, passwordHash: "raw-password" },
    { ...INPUT, passwordHash: PASSWORD_HASH.replace("$2b$", "$2y$") },
    { ...INPUT, updateExisting: "true" },
  ];

  for (const invalidInput of invalidInputs) {
    const harness = createHarness();
    await assert.rejects(
      provisionPrivilegedAccount(invalidInput, harness.database),
      (error) =>
        error instanceof PrivilegedAccountError &&
        error.code === "INVALID_INPUT" &&
        !error.message.includes("example.com"),
    );
    assert.deepEqual(harness.events, []);
  }
});

test("an invalid database clock rolls back before any user mutation", async () => {
  const harness = createHarness();
  harness.transaction.readDatabaseTime = async () => {
    harness.events.push("clock");
    return new Date(Number.NaN);
  };

  await assert.rejects(
    provisionPrivilegedAccount(INPUT, harness.database),
    (error) =>
      error instanceof PrivilegedAccountError &&
      error.code === "INVALID_DATABASE_CLOCK",
  );
  assert.deepEqual(harness.events, [
    "transaction:start",
    "lock:privileged@example.com",
    "clock",
    "transaction:rollback",
  ]);
  assert.deepEqual(harness.creates, []);
  assert.deepEqual(harness.updates, []);
});

test("verification cleanup failure rolls the whole privileged write back", async () => {
  const harness = createHarness("private-existing-user-id");
  harness.transaction.deleteEmailVerifications = async () => {
    harness.events.push("delete-email-verifications");
    throw new Error("private persistence detail");
  };

  await assert.rejects(
    provisionPrivilegedAccount(
      { ...INPUT, updateExisting: true },
      harness.database,
    ),
    (error) =>
      error instanceof PrivilegedAccountError &&
      error.code === "PERSISTENCE_FAILURE" &&
      !error.message.includes("private persistence detail"),
  );
  assert.deepEqual(harness.events, [
    "transaction:start",
    "lock:privileged@example.com",
    "clock",
    "update-user",
    "bump-session-revision-and-revoke",
    "delete-email-verifications",
    "transaction:rollback",
  ]);
});

test("password-reset cleanup failure rolls back the privileged write", async () => {
  const harness = createHarness("private-existing-user-id");
  harness.transaction.deletePasswordResets = async () => {
    harness.events.push("delete-password-resets");
    throw new Error("private reset persistence detail");
  };

  await assert.rejects(
    provisionPrivilegedAccount(
      { ...INPUT, updateExisting: true },
      harness.database,
    ),
    (error) =>
      error instanceof PrivilegedAccountError &&
      error.code === "PERSISTENCE_FAILURE" &&
      !error.message.includes("private reset persistence detail"),
  );
  assert.deepEqual(harness.events, [
    "transaction:start",
    "lock:privileged@example.com",
    "clock",
    "update-user",
    "bump-session-revision-and-revoke",
    "delete-email-verifications",
    "delete-password-resets",
    "transaction:rollback",
  ]);
});

test("session revision/revocation failure rolls back before credential cleanup", async () => {
  const harness = createHarness("private-existing-user-id");
  harness.transaction.bumpAuthSessionRevisionAndRevokeSessions = async () => {
    harness.events.push("bump-session-revision-and-revoke");
    return false;
  };

  await assert.rejects(
    provisionPrivilegedAccount(
      { ...INPUT, updateExisting: true },
      harness.database,
    ),
    (error) =>
      error instanceof PrivilegedAccountError &&
      error.code === "PERSISTENCE_FAILURE",
  );
  assert.deepEqual(harness.events, [
    "transaction:start",
    "lock:privileged@example.com",
    "clock",
    "update-user",
    "bump-session-revision-and-revoke",
    "transaction:rollback",
  ]);
  assert.deepEqual(harness.deletedVerificationUserIds, []);
  assert.deepEqual(harness.deletedPasswordResetUserIds, []);
});

interface RawQueryCall {
  sql: string;
  values: unknown[];
}

function fakePrismaClient(
  userLookupResults: Array<Array<{ id: string }>>,
  advisoryLockResult = true,
) {
  const events: string[] = [];
  const queries: RawQueryCall[] = [];
  const creates: unknown[] = [];
  const updates: unknown[] = [];
  const deletes: unknown[] = [];
  const resetDeletes: unknown[] = [];
  let userLookupIndex = 0;

  const transaction = {
    async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      const sql = strings.join("?");
      queries.push({ sql, values });
      if (sql.includes('FROM public."User"')) {
        events.push("query:user-for-update");
        return userLookupResults[userLookupIndex++] ?? [];
      }
      if (sql.includes("pg_advisory_xact_lock")) {
        events.push("query:advisory-lock");
        return [{ lockAcquired: advisoryLockResult }];
      }
      if (sql.includes("clock_timestamp()")) {
        events.push("query:clock");
        return [{ currentTimestamp: DATABASE_TIME }];
      }
      if (sql.includes('UPDATE public."User"')) {
        events.push("query:bump-session-revision-and-revoke");
        return [{ securityEpochAdvanced: true }];
      }
      throw new Error("unexpected raw query");
    },
    user: {
      async create(input: unknown) {
        events.push("prisma:create-user");
        creates.push(input);
        return { id: "private-created-user-id" };
      },
      async updateMany(input: unknown) {
        events.push("prisma:update-user");
        updates.push(input);
        return { count: 1 };
      },
    },
    emailVerification: {
      async deleteMany(input: unknown) {
        events.push("prisma:delete-verifications");
        deletes.push(input);
        return { count: 0 };
      },
    },
    passwordReset: {
      async deleteMany(input: unknown) {
        events.push("prisma:delete-password-resets");
        resetDeletes.push(input);
        return { count: 0 };
      },
    },
  };

  const client = {
    async $transaction(work: (value: typeof transaction) => Promise<unknown>) {
      events.push("prisma:transaction:start");
      const result = await work(transaction);
      events.push("prisma:transaction:commit");
      return result;
    },
  } as unknown as Parameters<
    typeof createPrismaPrivilegedAccountDatabase
  >[0];

  return {
    client,
    creates,
    deletes,
    events,
    queries,
    resetDeletes,
    updates,
  };
}

test("Prisma adapter locks User and reads clock afterward using bound values", async () => {
  const fake = fakePrismaClient([[{ id: "private-existing-user-id" }]]);
  const database = createPrismaPrivilegedAccountDatabase(fake.client);

  const result = await provisionPrivilegedAccount(
    { ...INPUT, updateExisting: true },
    database,
  );

  assert.deepEqual(result, { kind: "updated" });
  assert.deepEqual(fake.events, [
    "prisma:transaction:start",
    "query:user-for-update",
    "query:clock",
    "prisma:update-user",
    "query:bump-session-revision-and-revoke",
    "prisma:delete-verifications",
    "prisma:delete-password-resets",
    "prisma:transaction:commit",
  ]);
  assert.match(fake.queries[0]?.sql ?? "", /FOR UPDATE/);
  assert.equal(
    fake.queries[0]?.sql.includes("privileged@example.com"),
    false,
  );
  assert.deepEqual(fake.queries[0]?.values, ["privileged@example.com"]);
  assert.match(fake.queries[1]?.sql ?? "", /clock_timestamp\(\)/);
  assert.match(fake.queries[2]?.sql ?? "", /"authSessionRevision" = "authSessionRevision" \+ 1/);
  assert.match(
    fake.queries[2]?.sql ?? "",
    /"authSessionRevision" < 2147483647/,
  );
  assert.match(fake.queries[2]?.sql ?? "", /DELETE FROM public\."Session"/);
  assert.deepEqual(fake.queries[2]?.values, ["private-existing-user-id"]);
  assert.deepEqual(fake.updates, [
    {
      where: { id: "private-existing-user-id" },
      data: expectedSecurityWrite(),
    },
  ]);
  assert.deepEqual(fake.deletes, [
    { where: { userId: "private-existing-user-id" } },
  ]);
  assert.deepEqual(fake.resetDeletes, [
    { where: { userId: "private-existing-user-id" } },
  ]);
});

test("Prisma adapter serializes a missing email before create", async () => {
  const fake = fakePrismaClient([[], []]);
  const database = createPrismaPrivilegedAccountDatabase(fake.client);

  const result = await provisionPrivilegedAccount(INPUT, database);

  assert.deepEqual(result, { kind: "created" });
  assert.deepEqual(fake.events, [
    "prisma:transaction:start",
    "query:user-for-update",
    "query:advisory-lock",
    "query:user-for-update",
    "query:clock",
    "prisma:create-user",
    "prisma:delete-verifications",
    "prisma:delete-password-resets",
    "prisma:transaction:commit",
  ]);
  const advisoryQuery = fake.queries[1];
  assert.match(advisoryQuery?.sql ?? "", /pg_advisory_xact_lock/);
  assert.match(advisoryQuery?.sql ?? "", /WITH advisory_lock AS MATERIALIZED/);
  assert.match(advisoryQuery?.sql ?? "", /SELECT TRUE AS "lockAcquired"/);
  assert.match(advisoryQuery?.sql ?? "", /pg_catalog\.hashtextextended/);
  assert.equal(advisoryQuery?.sql.includes("privileged@example.com"), false);
  assert.deepEqual(advisoryQuery?.values, ["privileged@example.com"]);
  assert.equal(fake.creates.length, 1);
});

test("Prisma adapter fails closed for an invalid advisory lock wrapper result", async () => {
  const fake = fakePrismaClient([[]], false);
  const database = createPrismaPrivilegedAccountDatabase(fake.client);

  await assert.rejects(
    provisionPrivilegedAccount(INPUT, database),
    (error) =>
      error instanceof PrivilegedAccountError &&
      error.code === "PERSISTENCE_FAILURE",
  );
  assert.deepEqual(fake.events, [
    "prisma:transaction:start",
    "query:user-for-update",
    "query:advisory-lock",
  ]);
  assert.deepEqual(fake.creates, []);
});

test("napravljen nalog prolazi politiku prijave", async () => {
  // Ovo je veza koja je nedostajala, i zbog čije je odsutnosti greška mogla da
  // postoji: pravljenje naloga i politika prijave su se proveravali odvojeno.
  //
  // Bez izričitog `createdAt`, podrazumevana vrednost nastaje POSLE očitanog
  // `clock_timestamp()`, pa je `emailVerified` raniji od `createdAt` — u CI-ju
  // se to videlo kao razlika od jednog milisekunda. Politika takav snimak
  // odbija kao nemoguć, prijava puca sa `POLICY_DECISION / INTERNAL_FAILURE`, i
  // nalog se ne može prijaviti nikada.
  const harness = createHarness();
  await provisionPrivilegedAccount(INPUT, harness.database);

  const upisano = harness.creates[0];
  assert.ok(upisano);

  const odluka = evaluateVerifiedLoginPolicy({
    policy: "audit",
    role: upisano.role,
    createdAt: upisano.createdAt,
    emailVerified: upisano.emailVerified,
    emailVerificationLoginGraceUntil:
      upisano.emailVerificationLoginGraceUntil,
    stagedGraceDeadline: null,
    // Prijava se dešava kasnije, po satu iste baze.
    evaluatedAt: new Date(DATABASE_TIME.getTime() + 5_000),
  });

  assert.equal(odluka.allowed, true);
  assert.equal(odluka.reason, "VERIFIED");
});

test("napravljen nalog prolazi politiku i pod strict režimom", async () => {
  // `strict` odbija neverifikovan nalog. Privilegovan nalog je verifikovan u
  // istoj transakciji, pa mora proći i tu — inače bi pooštravanje politike
  // zaključalo same administratore.
  const harness = createHarness();
  await provisionPrivilegedAccount(INPUT, harness.database);

  const upisano = harness.creates[0];
  assert.ok(upisano);

  const odluka = evaluateVerifiedLoginPolicy({
    policy: "strict",
    role: upisano.role,
    createdAt: upisano.createdAt,
    emailVerified: upisano.emailVerified,
    emailVerificationLoginGraceUntil:
      upisano.emailVerificationLoginGraceUntil,
    stagedGraceDeadline: null,
    evaluatedAt: new Date(DATABASE_TIME.getTime() + 5_000),
  });

  assert.equal(odluka.allowed, true);
});
