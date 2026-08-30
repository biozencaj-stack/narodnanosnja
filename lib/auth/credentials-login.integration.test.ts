import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  authorizeCredentialsLogin,
  type CredentialsLoginAuthorizedUser,
  type CredentialsLoginPolicySnapshot,
} from "./credentials-login";
import { createPrismaCredentialsLoginDatabase } from "./credentials-login-database";
import { normalizeEmailAddress } from "./email-address";
import { hashPassword, verifyPassword } from "./password";

const RUN_DATABASE_TESTS =
  process.env.RUN_VERIFIED_LOGIN_DB_TESTS === "true";
const PASSWORD = "IntegracionaLozinka1!";
const CHANGED_PASSWORD = "PromenjenaLozinka2!";

function assertSafeTestDatabase(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL je obavezan za integration test verified login-a.",
    );
  }
  if (databaseUrl.trim() !== databaseUrl) {
    throw new Error("DATABASE_URL ne sme imati okolne razmake.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nije validna URL adresa.");
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error("Integration test zahteva PostgreSQL DATABASE_URL.");
  }
  if (
    !["127.0.0.1", "localhost", "::1", "[::1]"].includes(
      parsedUrl.hostname.toLowerCase(),
    )
  ) {
    throw new Error(
      "Integration test je odbijen: PostgreSQL mora biti lokalna test baza.",
    );
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(
      parsedUrl.pathname.replace(/^\/+/, ""),
    );
  } catch {
    throw new Error("Naziv baze u DATABASE_URL nije validno kodiran.");
  }
  if (
    !databaseName ||
    databaseName.includes("/") ||
    !/(?:^|[_-])(?:e2e|test|provera)(?:$|[_-])/i.test(databaseName) ||
    /(?:^|[_-])(?:prod|production|live)(?:$|[_-])/i.test(databaseName)
  ) {
    throw new Error(
      "Integration test je odbijen: naziv baze mora sadržati test, e2e ili provera.",
    );
  }

  return databaseName;
}

async function authorize(
  email: string,
  policy: "audit" | "staged" | "strict",
  database: ReturnType<typeof createPrismaCredentialsLoginDatabase>,
  stagedGraceDeadline: Date | null = null,
): Promise<CredentialsLoginAuthorizedUser | null> {
  return authorizeCredentialsLogin(
    { email, password: PASSWORD },
    { policy, stagedGraceDeadline, ...database },
  );
}

test(
  "Prisma credentials snapshot: policy, sveže mutacije i DB vreme posle User lock-a",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    const expectedDatabaseName = assertSafeTestDatabase();

    const { PrismaClient } = await import("@prisma/client");
    const database = new PrismaClient();
    const locker = new PrismaClient();
    const snapshotWorker = new PrismaClient();
    const runId = randomUUID();
    const createdUserIds: string[] = [];
    const cleanupEmails = new Set<string>();
    let releaseHeldLock: () => void = () => undefined;
    let heldLockTransaction: Promise<unknown> | null = null;
    let lockedSnapshotPromise: Promise<CredentialsLoginPolicySnapshot | null> | null =
      null;

    testContext.after(async () => {
      releaseHeldLock();
      const pendingTransactions = [
        heldLockTransaction,
        lockedSnapshotPromise,
      ].filter((pending): pending is Promise<unknown> => pending !== null);
      await Promise.allSettled(pendingTransactions);
      try {
        await database.user.deleteMany({
          where: {
            OR: [
              { id: { in: createdUserIds } },
              { email: { in: [...cleanupEmails] } },
            ],
          },
        });
      } finally {
        await Promise.allSettled([
          database.$disconnect(),
          locker.$disconnect(),
          snapshotWorker.$disconnect(),
        ]);
      }
    });

    // Validate the database reached by Prisma before creating any fixture;
    // this catches a URL/proxy mismatch even when the URL text passed guards.
    const databaseIdentity = await database.$queryRaw<
      Array<{ databaseName: string }>
    >`
      SELECT current_database() AS "databaseName"
    `;
    assert.deepEqual(databaseIdentity, [
      { databaseName: expectedDatabaseName },
    ]);

    const passwordHash = await hashPassword(PASSWORD);
    const changedPasswordHash = await hashPassword(CHANGED_PASSWORD);
    const prismaAdapter = createPrismaCredentialsLoginDatabase(database);

    async function createUser(
      purpose: string,
      values: {
        firstName?: string;
        graceUntil?: Date | null;
      } = {},
    ) {
      const email = `vl-${purpose}-${runId}@example.invalid`;
      assert.equal(
        normalizeEmailAddress(email),
        email,
        "integration fixture email mora ostati unutar runtime email ugovora",
      );
      cleanupEmails.add(email);
      const user = await database.user.create({
        data: {
          email,
          passwordHash,
          firstName: values.firstName ?? "Verified",
          lastName: "LoginTest",
          role: "CUSTOMER",
          emailVerificationLoginGraceUntil: values.graceUntil ?? null,
        },
        select: {
          id: true,
          email: true,
          createdAt: true,
        },
      });
      createdUserIds.push(user.id);
      return user;
    }

    async function markVerified(userId: string): Promise<void> {
      const updated = await database.$executeRaw`
        UPDATE public."User"
        SET "emailVerified" = clock_timestamp()
        WHERE "id" = ${userId}
      `;
      assert.equal(updated, 1);
    }

    const policyGraceDeadline = new Date(Date.now() + 7 * 86_400_000);
    const policyUser = await createUser("policy", {
      graceUntil: policyGraceDeadline,
    });
    const credential = await prismaAdapter.findCredentialByEmail(
      policyUser.email,
    );
    assert.deepEqual(credential, {
      id: policyUser.id,
      passwordHash,
    });
    assert.deepEqual(Object.keys(credential ?? {}).sort(), [
      "id",
      "passwordHash",
    ]);

    const stagedUser = await authorize(
      policyUser.email,
      "staged",
      prismaAdapter,
      policyGraceDeadline,
    );
    assert.equal(stagedUser?.id, policyUser.id);
    assert.equal(stagedUser?.requiresEmailVerification, true);
    assert.equal(
      await authorize(policyUser.email, "strict", prismaAdapter),
      null,
    );

    await markVerified(policyUser.id);
    const verifiedUser = await authorize(
      policyUser.email,
      "strict",
      prismaAdapter,
    );
    assert.equal(verifiedUser?.id, policyUser.id);
    assert.equal(verifiedUser?.requiresEmailVerification, false);

    const verifiedSnapshot = await prismaAdapter.readPolicySnapshot(
      policyUser.id,
    );
    assert.ok(verifiedSnapshot);
    assert.ok(verifiedSnapshot.emailVerified instanceof Date);
    assert.ok(verifiedSnapshot.evaluatedAt instanceof Date);
    assert.deepEqual(Object.keys(verifiedSnapshot).sort(), [
      "createdAt",
      "email",
      "emailVerificationLoginGraceUntil",
      "emailVerified",
      "evaluatedAt",
      "firstName",
      "id",
      "lastName",
      "passwordHash",
      "role",
    ]);
    assert.equal(
      await prismaAdapter.readPolicySnapshot(`missing-${runId}`),
      null,
    );

    const passwordMutationUser = await createUser("password-mutation");
    await markVerified(passwordMutationUser.id);
    let passwordMutatedAfterCompare = false;
    const passwordMutationResult = await authorizeCredentialsLogin(
      { email: passwordMutationUser.email, password: PASSWORD },
      {
        policy: "strict",
        stagedGraceDeadline: null,
        ...prismaAdapter,
        async comparePassword(submittedPassword, comparedHash) {
          const matches = await verifyPassword(
            submittedPassword,
            comparedHash,
          );
          assert.equal(matches, true);
          await database.user.update({
            where: { id: passwordMutationUser.id },
            data: { passwordHash: changedPasswordHash },
          });
          passwordMutatedAfterCompare = true;
          return matches;
        },
      },
    );
    assert.equal(passwordMutatedAfterCompare, true);
    assert.equal(passwordMutationResult, null);

    const emailMutationUser = await createUser("email-mutation");
    await markVerified(emailMutationUser.id);
    const changedEmail = `vl-email-mutated-${runId}@example.invalid`;
    assert.equal(normalizeEmailAddress(changedEmail), changedEmail);
    cleanupEmails.add(changedEmail);
    let emailMutatedAfterCompare = false;
    const emailMutationResult = await authorizeCredentialsLogin(
      { email: emailMutationUser.email, password: PASSWORD },
      {
        policy: "strict",
        stagedGraceDeadline: null,
        ...prismaAdapter,
        async comparePassword(submittedPassword, comparedHash) {
          const matches = await verifyPassword(
            submittedPassword,
            comparedHash,
          );
          assert.equal(matches, true);
          await database.user.update({
            where: { id: emailMutationUser.id },
            data: { email: changedEmail },
          });
          emailMutatedAfterCompare = true;
          return matches;
        },
      },
    );
    assert.equal(emailMutatedAfterCompare, true);
    assert.equal(emailMutationResult, null);

    const lockUser = await createUser("lock-clock", {
      firstName: "PreLock",
    });
    let signalLockAcquired: () => void = () => undefined;
    const lockAcquired = new Promise<void>((resolve) => {
      signalLockAcquired = resolve;
    });
    let requestLockRelease: () => void = () => undefined;
    const lockReleaseRequested = new Promise<void>((resolve) => {
      requestLockRelease = resolve;
    });
    releaseHeldLock = requestLockRelease;

    heldLockTransaction = locker.$transaction(
      async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM public."User"
          WHERE "id" = ${lockUser.id}
          FOR UPDATE
        `;
        assert.deepEqual(locked, [{ id: lockUser.id }]);
        await transaction.user.update({
          where: { id: lockUser.id },
          data: { firstName: "FreshAfterLock" },
        });
        signalLockAcquired();
        await lockReleaseRequested;
      },
      { maxWait: 5_000, timeout: 15_000 },
    );

    await Promise.race([
      lockAcquired,
      heldLockTransaction.then(() => {
        throw new Error("User lock je pušten pre signala testa.");
      }),
    ]);

    let resolveWorkerStart: (
      value: Readonly<{ pid: number; startedAt: Date }>,
    ) => void = () => undefined;
    let rejectWorkerStart: (error: unknown) => void = () => undefined;
    const workerStarted = new Promise<
      Readonly<{ pid: number; startedAt: Date }>
    >((resolve, reject) => {
      resolveWorkerStart = resolve;
      rejectWorkerStart = reject;
    });
    const observedWorker = {
      $transaction: async <T>(
        work: (transaction: Prisma.TransactionClient) => Promise<T>,
      ): Promise<T> => {
        try {
          return await snapshotWorker.$transaction(
            async (transaction) => {
              const rows = await transaction.$queryRaw<
                Array<{ pid: number; startedAt: Date }>
              >`
                SELECT
                  pg_backend_pid() AS "pid",
                  clock_timestamp() AS "startedAt"
              `;
              const started = rows[0];
              if (
                rows.length !== 1 ||
                !started ||
                !Number.isInteger(started.pid) ||
                !(started.startedAt instanceof Date)
              ) {
                throw new Error("Snapshot worker nema validan DB identitet.");
              }
              resolveWorkerStart(started);
              return work(transaction);
            },
            { maxWait: 5_000, timeout: 15_000 },
          );
        } catch (error) {
          rejectWorkerStart(error);
          throw error;
        }
      },
    } as unknown as PrismaClient;
    const observedAdapter =
      createPrismaCredentialsLoginDatabase(observedWorker);
    lockedSnapshotPromise = observedAdapter.readPolicySnapshot(
      lockUser.id,
    );
    const workerStart = await workerStarted;

    const lockWaitDeadline = Date.now() + 5_000;
    let observedDatabaseLockWait = false;
    while (Date.now() < lockWaitDeadline) {
      const activity = await database.$queryRaw<
        Array<{
          blocked: boolean;
          waitEventType: string | null;
        }>
      >`
        SELECT
          cardinality(
            pg_catalog.pg_blocking_pids(${workerStart.pid}::integer)
          ) > 0 AS "blocked",
          "wait_event_type" AS "waitEventType"
        FROM pg_catalog.pg_stat_activity
        WHERE "pid" = ${workerStart.pid}::integer
      `;
      if (
        activity[0]?.blocked === true &&
        activity[0]?.waitEventType === "Lock"
      ) {
        observedDatabaseLockWait = true;
        break;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(
      observedDatabaseLockWait,
      true,
      "snapshot worker nije primećen u PostgreSQL lock wait stanju",
    );

    // Advance by a measured DB-clock interval while the worker is known to be
    // blocked. This creates an unambiguous millisecond boundary without using
    // a fixed delay as evidence that the lock was acquired.
    const releaseBoundaryMs = workerStart.startedAt.getTime() + 10;
    let releasedAt: Date | null = null;
    while (!releasedAt || releasedAt.getTime() < releaseBoundaryMs) {
      const rows = await database.$queryRaw<Array<{ at: Date }>>`
        SELECT clock_timestamp() AS "at"
      `;
      const observedAt = rows[0]?.at;
      if (rows.length !== 1 || !(observedAt instanceof Date)) {
        throw new Error("Observer nema validno PostgreSQL vreme.");
      }
      releasedAt = observedAt;
    }

    requestLockRelease();
    await heldLockTransaction;
    const lockedSnapshot = await lockedSnapshotPromise;
    const completionRows = await database.$queryRaw<Array<{ at: Date }>>`
      SELECT clock_timestamp() AS "at"
    `;
    const completedAt = completionRows[0]?.at;
    assert.ok(completedAt instanceof Date);
    assert.ok(lockedSnapshot);
    assert.equal(lockedSnapshot.firstName, "FreshAfterLock");
    assert.ok(
      lockedSnapshot.evaluatedAt.getTime() >= releasedAt.getTime(),
      "DB vreme snapshot-a mora biti očitano tek posle čekanja na User lock",
    );
    assert.ok(
      lockedSnapshot.evaluatedAt.getTime() <= completedAt.getTime(),
    );
  },
);
