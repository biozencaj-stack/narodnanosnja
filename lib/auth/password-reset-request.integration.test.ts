import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import { hashCredentialToken } from "./credential-token";
import { CREDENTIALS_DUMMY_PASSWORD_HASH } from "./password";
import {
  PASSWORD_RESET_TOKEN_LIFETIME_MS,
  PasswordResetRequestConflictError,
  createPrismaPasswordResetRequestDatabase,
} from "./password-reset-request";

const RUN_DATABASE_TESTS =
  process.env.RUN_PASSWORD_RESET_REQUEST_DB_TESTS === "true" ||
  process.env.RUN_PASSWORD_RESET_CONFIRM_DB_TESTS === "true";

function assertSafeTestDatabase(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() !== databaseUrl) {
    throw new Error(
      "DATABASE_URL je obavezan za password-reset request DB test.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nije validna URL adresa.");
  }
  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error("Password-reset request test zahteva PostgreSQL.");
  }
  if (
    !["127.0.0.1", "localhost", "::1", "[::1]"].includes(
      parsedUrl.hostname.toLowerCase(),
    )
  ) {
    throw new Error(
      "Password-reset request DB test zahteva lokalnu test bazu.",
    );
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(
      parsedUrl.pathname.replace(/^\/+/, ""),
    );
  } catch {
    throw new Error("Naziv test baze nije validno kodiran.");
  }
  if (
    !databaseName ||
    databaseName.includes("/") ||
    !/(?:^|[_-])(?:e2e|test|provera)(?:$|[_-])/i.test(databaseName) ||
    /(?:^|[_-])(?:prod|production|live)(?:$|[_-])/i.test(databaseName)
  ) {
    throw new Error(
      "Password-reset request test je odbijen van namenske test baze.",
    );
  }
  return databaseName;
}

interface WorkerStart {
  pid: number;
  startedAt: Date;
}

function observedReplacementAdapter(
  prisma: PrismaClient,
  onStart: (started: WorkerStart) => void,
  onFailure: (error: unknown) => void,
) {
  const observedClient = {
    async $transaction<T>(
      work: (transaction: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
      try {
        return await prisma.$transaction(async (transaction) => {
          const rows = await transaction.$queryRaw<WorkerStart[]>`
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
            throw new Error("Password-reset worker nema validan DB identitet.");
          }
          onStart(started);
          return work(transaction);
        });
      } catch (error) {
        onFailure(error);
        throw error;
      }
    },
  } as unknown as Pick<PrismaClient, "$queryRaw" | "$transaction">;

  return createPrismaPasswordResetRequestDatabase(observedClient);
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
        cardinality(pg_blocking_pids(${pid})) > 0 AS "blocked",
        "wait_event_type" AS "waitEventType"
      FROM pg_catalog.pg_stat_activity
      WHERE "pid" = ${pid}
    `;
    if (
      rows[0]?.blocked === true &&
      rows[0]?.waitEventType === "Lock"
    ) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Password-reset worker nije primećen u DB lock wait-u.");
}

test(
  "password-reset request koristi User lock, svež xmin i DB vreme posle čekanja",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    const expectedDatabaseName = assertSafeTestDatabase();
    const { PrismaClient } = await import("@prisma/client");
    const observer = new PrismaClient();
    const locker = new PrismaClient();
    const worker = new PrismaClient();
    const staleWorker = new PrismaClient();
    const runId = randomUUID();
    const email = `reset-request-${runId}@example.invalid`;
    let releaseFirstLock: () => void = () => undefined;
    let releaseStaleLock: () => void = () => undefined;
    let firstLockTransaction: Promise<unknown> | null = null;
    let staleLockTransaction: Promise<unknown> | null = null;

    testContext.after(async () => {
      releaseFirstLock();
      releaseStaleLock();
      await Promise.allSettled(
        [firstLockTransaction, staleLockTransaction].filter(
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
          staleWorker.$disconnect(),
        ]);
      }
    });

    const identity = await observer.$queryRaw<
      Array<{ databaseName: string }>
    >`SELECT current_database() AS "databaseName"`;
    assert.deepEqual(identity, [{ databaseName: expectedDatabaseName }]);

    const user = await observer.user.create({
      data: {
        email,
        passwordHash: CREDENTIALS_DUMMY_PASSWORD_HASH,
        firstName: "Reset",
        lastName: "RequestTest",
        role: "CUSTOMER",
      },
      select: { id: true },
    });
    const observerAdapter =
      createPrismaPasswordResetRequestDatabase(observer);
    const expectedUser = await observerAdapter.findUserByEmail(email);
    assert.ok(expectedUser);

    let signalFirstLock: () => void = () => undefined;
    const firstLockAcquired = new Promise<void>((resolve) => {
      signalFirstLock = resolve;
    });
    const firstLockReleaseRequested = new Promise<void>((resolve) => {
      releaseFirstLock = resolve;
    });
    firstLockTransaction = locker.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM public."User"
        WHERE "id" = ${user.id}
        FOR UPDATE
      `;
      assert.deepEqual(rows, [{ id: user.id }]);
      signalFirstLock();
      await firstLockReleaseRequested;
    });
    await firstLockAcquired;

    let resolveFirstWorker: (started: WorkerStart) => void = () => undefined;
    let rejectFirstWorker: (error: unknown) => void = () => undefined;
    const firstWorkerStarted = new Promise<WorkerStart>((resolve, reject) => {
      resolveFirstWorker = resolve;
      rejectFirstWorker = reject;
    });
    const firstWorkerAdapter = observedReplacementAdapter(
      worker,
      resolveFirstWorker,
      rejectFirstWorker,
    );
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashCredentialToken("password-reset", rawToken);
    assert.ok(tokenHash);
    const replacement = firstWorkerAdapter.replaceTokensForRequest({
      expectedUser,
      legacyPlaintextToken: rawToken,
      tokenHash,
    });
    const firstWorker = await firstWorkerStarted;
    await waitForRowLock(observer, firstWorker.pid);

    const releaseBoundaryMs = firstWorker.startedAt.getTime() + 10;
    let releasedAt: Date | null = null;
    while (!releasedAt || releasedAt.getTime() < releaseBoundaryMs) {
      const rows = await observer.$queryRaw<Array<{ at: Date }>>`
        SELECT clock_timestamp() AS "at"
      `;
      const at = rows[0]?.at;
      if (rows.length !== 1 || !(at instanceof Date)) {
        throw new Error("Observer nema validno PostgreSQL vreme.");
      }
      releasedAt = at;
    }
    assert.ok(releasedAt);

    releaseFirstLock();
    await firstLockTransaction;
    const recipient = await replacement;
    assert.deepEqual(recipient, { email, firstName: "Reset" });
    const storedReset = await observer.passwordReset.findUniqueOrThrow({
      where: { userId: user.id },
      select: { id: true, tokenHash: true, expires: true },
    });
    assert.equal(storedReset.tokenHash, tokenHash);
    assert.ok(
      storedReset.expires.getTime() >=
        releasedAt.getTime() + PASSWORD_RESET_TOKEN_LIFETIME_MS,
      "reset expiry mora biti zasnovan na DB vremenu posle User lock wait-a",
    );

    const staleExpectedUser = await observerAdapter.findUserByEmail(email);
    assert.ok(staleExpectedUser);
    let signalStaleLock: () => void = () => undefined;
    const staleLockAcquired = new Promise<void>((resolve) => {
      signalStaleLock = resolve;
    });
    const staleLockReleaseRequested = new Promise<void>((resolve) => {
      releaseStaleLock = resolve;
    });
    staleLockTransaction = locker.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: user.id },
        data: { role: "ADMIN" },
      });
      // Mirrors privileged-account cleanup: User is changed/locked first,
      // then its reset credentials are removed in the same transaction.
      await transaction.passwordReset.deleteMany({
        where: { userId: user.id },
      });
      signalStaleLock();
      await staleLockReleaseRequested;
    });
    await staleLockAcquired;

    let resolveStaleWorker: (started: WorkerStart) => void = () => undefined;
    let rejectStaleWorker: (error: unknown) => void = () => undefined;
    const staleWorkerStarted = new Promise<WorkerStart>((resolve, reject) => {
      resolveStaleWorker = resolve;
      rejectStaleWorker = reject;
    });
    const staleWorkerAdapter = observedReplacementAdapter(
      staleWorker,
      resolveStaleWorker,
      rejectStaleWorker,
    );
    const staleRawToken = randomBytes(32).toString("hex");
    const staleTokenHash = hashCredentialToken(
      "password-reset",
      staleRawToken,
    );
    assert.ok(staleTokenHash);
    const replacementAfterPromotion =
      staleWorkerAdapter.replaceTokensForRequest({
        expectedUser: staleExpectedUser,
        legacyPlaintextToken: staleRawToken,
        tokenHash: staleTokenHash,
      });
    const staleRejection = assert.rejects(
      replacementAfterPromotion,
      PasswordResetRequestConflictError,
    );
    const startedStaleWorker = await staleWorkerStarted;
    await waitForRowLock(observer, startedStaleWorker.pid);
    releaseStaleLock();
    await staleLockTransaction;
    await staleRejection;

    const [userAfterPromotion, resetAfterPromotion] = await Promise.all([
      observer.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { role: true },
      }),
      observer.passwordReset.findUnique({
        where: { userId: user.id },
        select: { id: true },
      }),
    ]);
    assert.equal(userAfterPromotion.role, "ADMIN");
    assert.equal(resetAfterPromotion, null);
  },
);
