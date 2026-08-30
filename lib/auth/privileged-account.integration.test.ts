import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { hashCredentialToken } from "./credential-token";
import {
  PrivilegedAccountError,
  createPrismaPrivilegedAccountDatabase,
  provisionPrivilegedAccount,
} from "./privileged-account";

const RUN_DATABASE_TESTS =
  process.env.RUN_VERIFIED_LOGIN_DB_TESTS === "true";
const OLD_HASH = `$2a$12$${"a".repeat(53)}`;
const ADMIN_HASH = `$2b$12$${"b".repeat(53)}`;
const OPERATOR_HASH = `$2a$12$${"c".repeat(53)}`;

function assertSafeTestDatabase(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() !== databaseUrl) {
    throw new Error("DATABASE_URL je obavezan za privileged-account DB test.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nije validna URL adresa.");
  }
  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error("Privileged-account test zahteva PostgreSQL.");
  }
  if (
    !["127.0.0.1", "localhost", "::1", "[::1]"].includes(
      parsedUrl.hostname.toLowerCase(),
    )
  ) {
    throw new Error("Privileged-account DB test zahteva lokalnu test bazu.");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(
      parsedUrl.pathname.replace(/^\/+/, ""),
    );
  } catch {
    throw new Error("Naziv privileged-account test baze nije validan.");
  }
  if (
    !databaseName ||
    databaseName.includes("/") ||
    !/(?:^|[_-])(?:e2e|test|provera)(?:$|[_-])/i.test(databaseName) ||
    /(?:^|[_-])(?:prod|production|live)(?:$|[_-])/i.test(databaseName)
  ) {
    throw new Error(
      "Privileged-account test je odbijen van namenske test baze.",
    );
  }
  return databaseName;
}

async function assertDatabaseIdentity(
  prisma: PrismaClient,
  expectedDatabaseName: string,
): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ databaseName: string }>>`
    SELECT current_database() AS "databaseName"
  `;
  assert.deepEqual(rows, [{ databaseName: expectedDatabaseName }]);
}

function createTwoWorkerBarrier(): () => Promise<void> {
  let arrived = 0;
  let release: () => void = () => undefined;
  const bothArrived = new Promise<void>((resolve) => {
    release = resolve;
  });

  return async () => {
    arrived += 1;
    if (arrived === 2) release();
    await bothArrived;
  };
}

function barrierClient(
  prisma: PrismaClient,
  waitForBothWorkers: () => Promise<void>,
): Pick<PrismaClient, "$transaction"> {
  return {
    $transaction: (<T>(
      work: (transaction: Prisma.TransactionClient) => Promise<T>,
    ) =>
      prisma.$transaction(
        async (transaction) => {
          let firstUserLookup = true;
          const queryRaw = transaction.$queryRaw.bind(transaction) as (
            strings: TemplateStringsArray,
            ...values: unknown[]
          ) => Promise<unknown>;
          const wrappedTransaction = {
            async $queryRaw(
              strings: TemplateStringsArray,
              ...values: unknown[]
            ) {
              const rows = await queryRaw(strings, ...values);
              const sql = strings.join("?");
              if (
                firstUserLookup &&
                sql.includes('FROM public."User"')
              ) {
                firstUserLookup = false;
                assert.deepEqual(rows, []);
                // Both transactions have now proven the account absent before
                // either is allowed to request the advisory creation lock.
                await waitForBothWorkers();
              }
              return rows;
            },
            user: transaction.user,
            emailVerification: transaction.emailVerification,
            passwordReset: transaction.passwordReset,
          } as unknown as Prisma.TransactionClient;
          return work(wrappedTransaction);
        },
        { timeout: 15_000 },
      )) as PrismaClient["$transaction"],
  };
}

interface WorkerStart {
  pid: number;
  startedAt: Date;
}

function observedClient(
  prisma: PrismaClient,
  onStart: (started: WorkerStart) => void,
  onFailure: (error: unknown) => void,
): Pick<PrismaClient, "$transaction"> {
  return {
    $transaction: (<T>(
      work: (transaction: Prisma.TransactionClient) => Promise<T>,
    ) =>
      prisma.$transaction(
        async (transaction) => {
          try {
            const rows = await transaction.$queryRaw<WorkerStart[]>`
              SELECT
                pg_backend_pid() AS "pid",
                clock_timestamp()::timestamptz(3) AS "startedAt"
            `;
            const started = rows[0];
            if (
              rows.length !== 1 ||
              !started ||
              !Number.isInteger(started.pid) ||
              !(started.startedAt instanceof Date)
            ) {
              throw new Error("Privileged worker nema validan DB identitet.");
            }
            onStart(started);
            return work(transaction);
          } catch (error) {
            onFailure(error);
            throw error;
          }
        },
        { timeout: 15_000 },
      )) as PrismaClient["$transaction"],
  };
}

async function waitForRowLock(
  observer: PrismaClient,
  pid: number,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const rows = await observer.$queryRaw<
      Array<{ blocked: boolean; waitEventType: string | null }>
    >`
      SELECT
        cardinality(
          pg_catalog.pg_blocking_pids(${pid}::integer)
        ) > 0 AS "blocked",
        "wait_event_type" AS "waitEventType"
      FROM pg_catalog.pg_stat_activity
      WHERE "pid" = ${pid}::integer
    `;
    if (
      rows[0]?.blocked === true &&
      rows[0]?.waitEventType === "Lock"
    ) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Privileged worker nije primećen u DB lock wait-u.");
}

test(
  "dva missing-email provision worker-a daju tačno created i exists",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    const expectedDatabaseName = assertSafeTestDatabase();
    const { PrismaClient } = await import("@prisma/client");
    const observer = new PrismaClient();
    const firstWorker = new PrismaClient();
    const secondWorker = new PrismaClient();
    const runId = randomUUID();
    const email = `privileged-create-${runId}@example.invalid`;

    testContext.after(async () => {
      try {
        await observer.user.deleteMany({ where: { email } });
      } finally {
        await Promise.allSettled([
          observer.$disconnect(),
          firstWorker.$disconnect(),
          secondWorker.$disconnect(),
        ]);
      }
    });

    await assertDatabaseIdentity(observer, expectedDatabaseName);
    const barrier = createTwoWorkerBarrier();
    const databases = [firstWorker, secondWorker].map((worker) =>
      createPrismaPrivilegedAccountDatabase(barrierClient(worker, barrier)),
    );
    const input = {
      email,
      passwordHash: ADMIN_HASH,
      role: "ADMIN" as const,
    };

    const results = await Promise.all(
      databases.map((database) =>
        provisionPrivilegedAccount(input, database),
      ),
    );

    assert.deepEqual(
      results.map((result) => result.kind).sort(),
      ["created", "exists"],
    );
    assert.equal(await observer.user.count({ where: { email } }), 1);
    const stored = await observer.user.findUniqueOrThrow({
      where: { email },
      select: {
        passwordHash: true,
        role: true,
        emailVerified: true,
      },
    });
    assert.equal(stored.passwordHash, ADMIN_HASH);
    assert.equal(stored.role, "ADMIN");
    assert.ok(stored.emailVerified instanceof Date);
  },
);

test(
  "privileged DB clock se čita tek posle stvarnog User lock wait-a",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    const expectedDatabaseName = assertSafeTestDatabase();
    const { PrismaClient } = await import("@prisma/client");
    const observer = new PrismaClient();
    const locker = new PrismaClient();
    const worker = new PrismaClient();
    const runId = randomUUID();
    const email = `privileged-lock-${runId}@example.invalid`;
    let releaseLock: () => void = () => undefined;
    let heldTransaction: Promise<unknown> | null = null;
    let workerProvisioning: Promise<unknown> | null = null;

    testContext.after(async () => {
      releaseLock();
      await Promise.allSettled(
        [heldTransaction, workerProvisioning].filter(
          (value): value is Promise<unknown> => value !== null,
        ),
      );
      try {
        await observer.user.deleteMany({ where: { email } });
      } finally {
        await Promise.allSettled([
          observer.$disconnect(),
          locker.$disconnect(),
          worker.$disconnect(),
        ]);
      }
    });

    await assertDatabaseIdentity(observer, expectedDatabaseName);
    const user = await observer.user.create({
      data: {
        email,
        passwordHash: OLD_HASH,
        firstName: "Privileged",
        lastName: "LockTest",
        role: "CUSTOMER",
      },
      select: { id: true, createdAt: true },
    });

    let signalLock: () => void = () => undefined;
    const lockAcquired = new Promise<void>((resolve) => {
      signalLock = resolve;
    });
    const lockReleaseRequested = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    heldTransaction = locker.$transaction(
      async (transaction) => {
        const rows = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM public."User"
          WHERE "id" = ${user.id}
          FOR UPDATE
        `;
        assert.deepEqual(rows, [{ id: user.id }]);
        signalLock();
        await lockReleaseRequested;
      },
      { timeout: 15_000 },
    );
    await Promise.race([
      lockAcquired,
      heldTransaction.then(() => {
        throw new Error("User lock je pušten pre signala testa.");
      }),
    ]);

    let resolveWorker: (started: WorkerStart) => void = () => undefined;
    let rejectWorker: (error: unknown) => void = () => undefined;
    const workerStarted = new Promise<WorkerStart>((resolve, reject) => {
      resolveWorker = resolve;
      rejectWorker = reject;
    });
    const database = createPrismaPrivilegedAccountDatabase(
      observedClient(worker, resolveWorker, rejectWorker),
    );
    const provisioning = provisionPrivilegedAccount(
      {
        email,
        passwordHash: OPERATOR_HASH,
        role: "OPERATOR",
        updateExisting: true,
      },
      database,
    );
    workerProvisioning = provisioning;
    const started = await workerStarted;
    await waitForRowLock(observer, started.pid);

    const releaseBoundaryMs = started.startedAt.getTime() + 10;
    let releasedAt: Date | null = null;
    while (!releasedAt || releasedAt.getTime() < releaseBoundaryMs) {
      const rows = await observer.$queryRaw<Array<{ at: Date }>>`
        SELECT clock_timestamp()::timestamptz(3) AS "at"
      `;
      const at = rows[0]?.at;
      if (rows.length !== 1 || !(at instanceof Date)) {
        throw new Error("Privileged observer nema validno DB vreme.");
      }
      releasedAt = at;
    }
    assert.ok(releasedAt);

    releaseLock();
    await heldTransaction;
    assert.deepEqual(await provisioning, { kind: "updated" });
    const stored = await observer.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        createdAt: true,
        emailVerified: true,
        passwordHash: true,
        role: true,
      },
    });
    assert.ok(stored.emailVerified instanceof Date);
    assert.ok(stored.createdAt.getTime() <= stored.emailVerified.getTime());
    assert.ok(stored.emailVerified.getTime() >= releasedAt.getTime());
    assert.equal(stored.passwordHash, OPERATOR_HASH);
    assert.equal(stored.role, "OPERATOR");
  },
);

test(
  "PasswordReset cleanup kvar vraća User i oba tokena, a retry uspeva",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    const expectedDatabaseName = assertSafeTestDatabase();
    const { PrismaClient } = await import("@prisma/client");
    const observer = new PrismaClient();
    const failingWorker = new PrismaClient();
    const retryWorker = new PrismaClient();
    const runId = randomUUID();
    const email = `privileged-rollback-${runId}@example.invalid`;

    testContext.after(async () => {
      try {
        await observer.user.deleteMany({ where: { email } });
      } finally {
        await Promise.allSettled([
          observer.$disconnect(),
          failingWorker.$disconnect(),
          retryWorker.$disconnect(),
        ]);
      }
    });

    await assertDatabaseIdentity(observer, expectedDatabaseName);
    const user = await observer.user.create({
      data: {
        email,
        passwordHash: OLD_HASH,
        firstName: "Privileged",
        lastName: "RollbackTest",
        role: "CUSTOMER",
      },
      select: { id: true },
    });
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenHash = hashCredentialToken(
      "password-reset",
      resetToken,
    );
    const verificationToken = randomBytes(32).toString("hex");
    const verificationTokenHash = hashCredentialToken(
      "email-verification",
      verificationToken,
    );
    assert.ok(resetTokenHash);
    assert.ok(verificationTokenHash);
    const expires = new Date(Date.now() + 60_000);
    await observer.passwordReset.create({
      data: {
        userId: user.id,
        token: resetToken,
        tokenHash: resetTokenHash,
        expires,
      },
    });
    await observer.emailVerification.create({
      data: {
        userId: user.id,
        token: verificationToken,
        tokenHash: verificationTokenHash,
        expires,
      },
    });

    const events: string[] = [];
    const failingClient = {
      $transaction: (<T>(
        work: (transaction: Prisma.TransactionClient) => Promise<T>,
      ) =>
        failingWorker.$transaction(async (transaction) => {
          const wrappedTransaction = {
            $queryRaw: transaction.$queryRaw.bind(transaction),
            user: transaction.user,
            emailVerification: {
              async deleteMany(input: Parameters<
                typeof transaction.emailVerification.deleteMany
              >[0]) {
                events.push("delete-email-verifications");
                return transaction.emailVerification.deleteMany(input);
              },
            },
            passwordReset: {
              async deleteMany() {
                events.push("fail-password-reset-cleanup");
                const insideUser = await transaction.user.findUniqueOrThrow({
                  where: { id: user.id },
                  select: {
                    passwordHash: true,
                    role: true,
                    emailVerified: true,
                  },
                });
                assert.equal(insideUser.passwordHash, ADMIN_HASH);
                assert.equal(insideUser.role, "ADMIN");
                assert.ok(insideUser.emailVerified instanceof Date);
                assert.equal(
                  await transaction.emailVerification.count({
                    where: { userId: user.id },
                  }),
                  0,
                );
                assert.equal(
                  await transaction.passwordReset.count({
                    where: { userId: user.id },
                  }),
                  1,
                );
                throw new Error("Injected PasswordReset cleanup failure");
              },
            },
          } as unknown as Prisma.TransactionClient;
          return work(wrappedTransaction);
        })) as PrismaClient["$transaction"],
    };
    const failingDatabase = createPrismaPrivilegedAccountDatabase(
      failingClient as Pick<PrismaClient, "$transaction">,
    );
    const input = {
      email,
      passwordHash: ADMIN_HASH,
      role: "ADMIN" as const,
      updateExisting: true,
    };

    await assert.rejects(
      provisionPrivilegedAccount(input, failingDatabase),
      (error) =>
        error instanceof PrivilegedAccountError &&
        error.code === "PERSISTENCE_FAILURE" &&
        !error.message.includes(email) &&
        !error.message.includes(ADMIN_HASH) &&
        !error.message.includes("Injected"),
    );
    assert.deepEqual(events, [
      "delete-email-verifications",
      "fail-password-reset-cleanup",
    ]);

    const rolledBackUser = await observer.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        passwordHash: true,
        role: true,
        emailVerified: true,
      },
    });
    assert.deepEqual(rolledBackUser, {
      passwordHash: OLD_HASH,
      role: "CUSTOMER",
      emailVerified: null,
    });
    assert.deepEqual(
      await Promise.all([
        observer.passwordReset.count({ where: { userId: user.id } }),
        observer.emailVerification.count({ where: { userId: user.id } }),
      ]),
      [1, 1],
    );

    const retryDatabase = createPrismaPrivilegedAccountDatabase(retryWorker);
    assert.deepEqual(
      await provisionPrivilegedAccount(input, retryDatabase),
      { kind: "updated" },
    );
    const retriedUser = await observer.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        passwordHash: true,
        role: true,
        emailVerified: true,
      },
    });
    assert.equal(retriedUser.passwordHash, ADMIN_HASH);
    assert.equal(retriedUser.role, "ADMIN");
    assert.ok(retriedUser.emailVerified instanceof Date);
    assert.deepEqual(
      await Promise.all([
        observer.passwordReset.count({ where: { userId: user.id } }),
        observer.emailVerification.count({ where: { userId: user.id } }),
      ]),
      [0, 0],
    );
  },
);
