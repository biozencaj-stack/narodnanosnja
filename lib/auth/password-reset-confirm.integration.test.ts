import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  createCredentialTokenLookupKeys,
  hashCredentialToken,
} from "./credential-token";
import { hashPassword, validatePassword, verifyPassword } from "./password";
import {
  commitPasswordResetConfirmation,
  type PasswordResetConfirmClaim,
  type PasswordResetConfirmDatabase,
} from "./password-reset-confirm";
import {
  PASSWORD_RESET_CONFIRM_INVALID_MESSAGE,
  PASSWORD_RESET_CONFIRM_SUCCESS_MESSAGE,
  createPasswordResetConfirmHandler,
  type PasswordResetConfirmFailure,
} from "./password-reset-confirm-route";

const RUN_DATABASE_TESTS =
  process.env.RUN_PASSWORD_RESET_CONFIRM_DB_TESTS === "true";

function assertSafeTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL je obavezan za integration test potvrde resetovanja.",
    );
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
      parsedUrl.hostname,
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
  if (!/(?:^|[_-])(?:e2e|test|provera)(?:$|[_-])/i.test(databaseName)) {
    throw new Error(
      "Integration test je odbijen: naziv baze mora sadržati test, e2e ili provera.",
    );
  }
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

function databaseAdapter(prisma: PrismaClient): PasswordResetConfirmDatabase {
  return {
    $transaction: (work) =>
      prisma.$transaction((transaction) => work(transaction)),
  };
}

function barrierDatabaseAdapter(
  prisma: PrismaClient,
  waitForBothWorkers: () => Promise<void>,
): PasswordResetConfirmDatabase {
  return {
    $transaction: (work) =>
      prisma.$transaction(async (transaction) => {
        await waitForBothWorkers();
        return work(transaction);
      }),
  };
}

interface ObservedWorkerStart {
  pid: number;
  startedAt: Date;
}

function observedDatabaseAdapter(
  prisma: PrismaClient,
  onStart: (worker: ObservedWorkerStart) => void,
  onFailure: (error: unknown) => void,
): PasswordResetConfirmDatabase {
  return {
    $transaction: async (work) => {
      try {
        return await prisma.$transaction(
          async (transaction) => {
            const rows = await transaction.$queryRaw<ObservedWorkerStart[]>`
              SELECT
                pg_backend_pid() AS "pid",
                clock_timestamp()::timestamptz(3) AS "startedAt"
            `;
            const started = rows[0];
            if (
              rows.length !== 1 ||
              !started ||
              !Number.isInteger(started.pid) ||
              !(started.startedAt instanceof Date) ||
              !Number.isFinite(started.startedAt.getTime())
            ) {
              throw new Error("Reset confirm worker nema validan DB identitet");
            }
            onStart(started);
            return work(transaction);
          },
          { timeout: 15_000 },
        );
      } catch (error) {
        onFailure(error);
        throw error;
      }
    },
  };
}

async function waitForSpecificRowLock(
  observer: PrismaClient,
  workerPid: number,
  blockerPid: number,
): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const rows = await observer.$queryRaw<
      Array<{ waitEventType: string | null; blockingPids: number[] }>
    >`
      SELECT
        "wait_event_type" AS "waitEventType",
        pg_catalog.pg_blocking_pids("pid") AS "blockingPids"
      FROM pg_catalog.pg_stat_activity
      WHERE "pid" = ${workerPid}
    `;
    if (
      rows[0]?.waitEventType === "Lock" &&
      rows[0].blockingPids.includes(blockerPid)
    ) {
      return;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    "Reset confirm worker nije primećen u PasswordReset row-lock wait-u",
  );
}

function failingAfterClaimDeleteAdapter(
  prisma: PrismaClient,
): PasswordResetConfirmDatabase {
  return {
    $transaction: (work) =>
      prisma.$transaction(async (transaction) => {
        let exactClaimWasDeleted = false;
        return work({
          $queryRaw: (strings, ...values) =>
            transaction.$queryRaw(strings, ...values),
          emailVerification: {
            deleteMany: (input) =>
              transaction.emailVerification.deleteMany(input),
          },
          passwordReset: {
            async deleteMany(input) {
              if ("id" in input.where) {
                const result = await transaction.passwordReset.deleteMany(
                  input,
                );
                assert.equal(result.count, 1);
                exactClaimWasDeleted = true;
                return result;
              }
              assert.equal(exactClaimWasDeleted, true);
              throw new Error("Injected reset sibling cleanup failure");
            },
          },
          user: {
            updateMany: (input) => transaction.user.updateMany(input),
          },
        });
      }),
  };
}

function trustedRequest(token: string, password: string): NextRequest {
  return new NextRequest(
    "https://shop.example.test/api/auth/reset-password/confirm",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "shop.example.test",
        origin: "https://shop.example.test",
      },
      body: JSON.stringify({ token, password }),
    },
  );
}

function createDatabaseHandler(
  prisma: PrismaClient,
  database: PasswordResetConfirmDatabase,
  failures: PasswordResetConfirmFailure[],
  lookupCounts: { hash: number; legacy: number },
  commitCounts?: { attempts: number; winners: number },
) {
  return createPasswordResetConfirmHandler({
    checkRateLimit: () => true,
    validatePassword,
    createLookupKeys: (token) =>
      createCredentialTokenLookupKeys("password-reset", token),
    async findByCurrentHash(currentHash) {
      lookupCounts.hash += 1;
      return prisma.passwordReset.findUnique({
        where: { tokenHash: currentHash },
        select: {
          id: true,
          userId: true,
          token: true,
          tokenHash: true,
          expires: true,
        },
      });
    },
    async findByLegacyToken(legacyPlaintext) {
      lookupCounts.legacy += 1;
      return prisma.passwordReset.findFirst({
        where: {
          token: legacyPlaintext,
          tokenHash: null,
        },
        select: {
          id: true,
          userId: true,
          token: true,
          tokenHash: true,
          expires: true,
        },
      });
    },
    hashPassword,
    prepareSuccessResponse: () =>
      NextResponse.json({
        message: PASSWORD_RESET_CONFIRM_SUCCESS_MESSAGE,
      }),
    async commitReset(claim, passwordHash) {
      if (commitCounts) commitCounts.attempts += 1;
      await commitPasswordResetConfirmation(
        database,
        claim,
        passwordHash,
      );
      if (commitCounts) commitCounts.winners += 1;
    },
    reportFailure(failure) {
      failures.push(failure);
    },
  });
}

test(
  "hash i legacy reset claim: dva radnika imaju jednog pobednika, a rollback ostaje retryable",
  { skip: !RUN_DATABASE_TESTS, timeout: 40_000 },
  async (testContext) => {
    assertSafeTestDatabase();

    const { prisma } = await import("@/lib/db");
    const userIds: string[] = [];
    testContext.after(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      } finally {
        await prisma.$disconnect();
      }
    });

    const runId = randomUUID();
    const resetAt = new Date();
    const expires = new Date(resetAt.getTime() + 60_000);

    // Current hash fixture: both workers read the same row before a barrier
    // inside their transactions. Exactly one conditional delete may claim it.
    const hashUser = await prisma.user.create({
      data: {
        email: `reset-hash-${runId}@example.invalid`,
        passwordHash: await hashPassword("StaraLozinka1!"),
        firstName: "Reset",
        lastName: "Hash",
      },
    });
    userIds.push(hashUser.id);
    const hashRawToken = randomBytes(32).toString("hex");
    const currentHash = hashCredentialToken("password-reset", hashRawToken);
    assert.ok(currentHash);
    await prisma.passwordReset.create({
      data: {
        userId: hashUser.id,
        token: null,
        tokenHash: currentHash,
        expires,
      },
    });
    const verificationRawToken = randomBytes(32).toString("hex");
    const verificationHash = hashCredentialToken(
      "email-verification",
      verificationRawToken,
    );
    assert.ok(verificationHash);
    await prisma.emailVerification.create({
      data: {
        userId: hashUser.id,
        token: null,
        tokenHash: verificationHash,
        expires,
      },
    });

    const barrier = createTwoWorkerBarrier();
    const hashFailures: PasswordResetConfirmFailure[] = [];
    const hashLookups = { hash: 0, legacy: 0 };
    const commitCounts = { attempts: 0, winners: 0 };
    const hashHandler = createDatabaseHandler(
      prisma,
      barrierDatabaseAdapter(prisma, barrier),
      hashFailures,
      hashLookups,
      commitCounts,
    );
    const candidatePasswords = ["PrvaNova1!", "DrugaNova2!"] as const;
    const hashResponses = await Promise.all(
      candidatePasswords.map((password) =>
        hashHandler(trustedRequest(hashRawToken, password)),
      ),
    );
    const winnerIndexes = hashResponses
      .map((response, index) => ({ response, index }))
      .filter(({ response }) => response.status === 200)
      .map(({ index }) => index);
    const loserResponses = hashResponses.filter(
      (response) => response.status === 400,
    );

    assert.deepEqual(winnerIndexes.length, 1);
    assert.equal(loserResponses.length, 1);
    assert.deepEqual(await loserResponses[0]?.json(), {
      error: "Neispravan ili istekao link za reset lozinke",
    });
    assert.deepEqual(hashLookups, { hash: 2, legacy: 0 });
    assert.deepEqual(commitCounts, { attempts: 2, winners: 1 });
    assert.deepEqual(hashFailures, [{ stage: "COMMIT" }]);

    const hashUserAfter = await prisma.user.findUniqueOrThrow({
      where: { id: hashUser.id },
      select: { passwordHash: true },
    });
    const winnerIndex = winnerIndexes[0];
    assert.equal(
      await verifyPassword(
        candidatePasswords[winnerIndex],
        hashUserAfter.passwordHash,
      ),
      true,
    );
    assert.equal(
      await verifyPassword(
        candidatePasswords[winnerIndex === 0 ? 1 : 0],
        hashUserAfter.passwordHash,
      ),
      false,
    );
    assert.equal(
      await prisma.passwordReset.count({ where: { userId: hashUser.id } }),
      0,
    );
    assert.equal(
      await prisma.emailVerification.count({
        where: { userId: hashUser.id },
      }),
      0,
      "successful reset must revoke the real verification credential",
    );

    // Legacy fixture proves hash-first miss followed by the compatibility key.
    const legacyUser = await prisma.user.create({
      data: {
        email: `reset-legacy-${runId}@example.invalid`,
        passwordHash: await hashPassword("StaraLozinka1!"),
        firstName: "Reset",
        lastName: "Legacy",
      },
    });
    userIds.push(legacyUser.id);
    const legacyRawToken = randomBytes(32).toString("hex");
    await prisma.passwordReset.create({
      data: {
        userId: legacyUser.id,
        token: legacyRawToken,
        tokenHash: null,
        expires,
      },
    });
    const legacyFailures: PasswordResetConfirmFailure[] = [];
    const legacyLookups = { hash: 0, legacy: 0 };
    const legacyPassword = "LegacyNova3!";
    const legacyHandler = createDatabaseHandler(
      prisma,
      databaseAdapter(prisma),
      legacyFailures,
      legacyLookups,
    );
    const legacyResponse = await legacyHandler(
      trustedRequest(legacyRawToken, legacyPassword),
    );

    assert.equal(legacyResponse.status, 200);
    assert.deepEqual(legacyLookups, { hash: 1, legacy: 1 });
    assert.deepEqual(legacyFailures, []);
    const legacyUserAfter = await prisma.user.findUniqueOrThrow({
      where: { id: legacyUser.id },
      select: { passwordHash: true },
    });
    assert.equal(
      await verifyPassword(legacyPassword, legacyUserAfter.passwordHash),
      true,
    );
    assert.equal(
      await prisma.passwordReset.count({ where: { userId: legacyUser.id } }),
      0,
    );

    // A failure after the conditional delete must roll the transaction back.
    // The exact same claim can then be retried successfully.
    const rollbackUser = await prisma.user.create({
      data: {
        email: `reset-rollback-${runId}@example.invalid`,
        passwordHash: await hashPassword("StaraLozinka1!"),
        firstName: "Reset",
        lastName: "Rollback",
      },
    });
    userIds.push(rollbackUser.id);
    const rollbackRawToken = randomBytes(32).toString("hex");
    const rollbackHash = hashCredentialToken(
      "password-reset",
      rollbackRawToken,
    );
    assert.ok(rollbackHash);
    const rollbackRow = await prisma.passwordReset.create({
      data: {
        userId: rollbackUser.id,
        token: null,
        tokenHash: rollbackHash,
        expires,
      },
    });
    const rollbackClaim: PasswordResetConfirmClaim = {
      id: rollbackRow.id,
      userId: rollbackUser.id,
      credential: {
        kind: "current-hash",
        storedValue: rollbackHash,
      },
    };
    const retryPassword = "PosleRollback4!";
    const retryPasswordHash = await hashPassword(retryPassword);

    await assert.rejects(
      commitPasswordResetConfirmation(
        failingAfterClaimDeleteAdapter(prisma),
        rollbackClaim,
        retryPasswordHash,
      ),
      /Injected reset sibling cleanup failure/,
    );
    const [rowAfterRollback, userAfterRollback] = await Promise.all([
      prisma.passwordReset.findUnique({ where: { id: rollbackRow.id } }),
      prisma.user.findUniqueOrThrow({
        where: { id: rollbackUser.id },
        select: { passwordHash: true },
      }),
    ]);
    assert.ok(rowAfterRollback);
    assert.equal(userAfterRollback.passwordHash, rollbackUser.passwordHash);

    await commitPasswordResetConfirmation(
      databaseAdapter(prisma),
      rollbackClaim,
      retryPasswordHash,
    );
    const [rowAfterRetry, userAfterRetry] = await Promise.all([
      prisma.passwordReset.findUnique({ where: { id: rollbackRow.id } }),
      prisma.user.findUniqueOrThrow({
        where: { id: rollbackUser.id },
        select: { passwordHash: true },
      }),
    ]);
    assert.equal(rowAfterRetry, null);
    assert.equal(
      await verifyPassword(retryPassword, userAfterRetry.passwordHash),
      true,
    );
  },
);

test(
  "reset confirm meri DB vreme posle stvarnog PasswordReset lock wait-a i odbacuje pripremljeni cookie bez mutacije",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    assertSafeTestDatabase();

    const { PrismaClient: RuntimePrismaClient } = await import(
      "@prisma/client"
    );
    const observer = new RuntimePrismaClient();
    const locker = new RuntimePrismaClient();
    const worker = new RuntimePrismaClient();
    const runId = randomUUID();
    const email = `reset-confirm-lock-${runId}@example.invalid`;
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashCredentialToken("password-reset", rawToken);
    assert.ok(tokenHash);

    let releaseTokenLock: () => void = () => undefined;
    let lockerTransaction: Promise<unknown> | null = null;
    let confirmation: Promise<NextResponse> | null = null;
    testContext.after(async () => {
      releaseTokenLock();
      await Promise.allSettled(
        [lockerTransaction, confirmation].filter(
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

    const oldPasswordHash = await hashPassword("StaraLockLozinka1!");
    const user = await observer.user.create({
      data: {
        email,
        passwordHash: oldPasswordHash,
        firstName: "Reset",
        lastName: "Lock",
      },
      select: { id: true, updatedAt: true },
    });
    const reset = await observer.passwordReset.create({
      data: {
        userId: user.id,
        token: null,
        tokenHash,
        expires: new Date(Date.now() + 60_000),
      },
      select: { id: true },
    });

    let signalTokenLock: (state: {
      pid: number;
      expiresAt: Date;
    }) => void = () => undefined;
    const tokenLockAcquired = new Promise<{
      pid: number;
      expiresAt: Date;
    }>((resolve) => {
      signalTokenLock = resolve;
    });
    const releaseRequested = new Promise<void>((resolve) => {
      releaseTokenLock = resolve;
    });
    lockerTransaction = locker.$transaction(
      async (transaction) => {
        const pidRows = await transaction.$queryRaw<Array<{ pid: number }>>`
          SELECT pg_backend_pid() AS "pid"
        `;
        const blockerPid = pidRows[0]?.pid;
        assert.equal(pidRows.length, 1);
        assert.ok(Number.isInteger(blockerPid));

        await transaction.$executeRaw`
          UPDATE public."PasswordReset"
          SET "expires" =
            clock_timestamp()::timestamptz(3) + INTERVAL '3 seconds'
          WHERE "id" = ${reset.id}
        `;
        const rows = await transaction.$queryRaw<
          Array<{ id: string; expires: Date }>
        >`
          SELECT "id", "expires"
          FROM public."PasswordReset"
          WHERE "id" = ${reset.id}
        `;
        const locked = rows[0];
        assert.equal(rows.length, 1);
        assert.equal(locked?.id, reset.id);
        assert.ok(locked?.expires instanceof Date);
        signalTokenLock({
          pid: blockerPid as number,
          expiresAt: locked.expires,
        });
        await releaseRequested;
      },
      { timeout: 15_000 },
    );

    const { pid: blockerPid, expiresAt } = await Promise.race([
      tokenLockAcquired,
      lockerTransaction.then(() => {
        throw new Error("PasswordReset lock je pušten pre signala testa");
      }),
    ]);

    let resolveWorker: (started: ObservedWorkerStart) => void = () =>
      undefined;
    let rejectWorker: (error: unknown) => void = () => undefined;
    const workerStarted = new Promise<ObservedWorkerStart>(
      (resolve, reject) => {
        resolveWorker = resolve;
        rejectWorker = reject;
      },
    );
    const failures: PasswordResetConfirmFailure[] = [];
    let preparedCookie: string | null = null;
    const handler = createPasswordResetConfirmHandler({
      checkRateLimit: () => true,
      validatePassword,
      createLookupKeys: (token) =>
        createCredentialTokenLookupKeys("password-reset", token),
      findByCurrentHash: (currentHash) =>
        observer.passwordReset.findUnique({
          where: { tokenHash: currentHash },
          select: {
            id: true,
            userId: true,
            token: true,
            tokenHash: true,
            expires: true,
          },
        }),
      findByLegacyToken: (legacyPlaintext) =>
        observer.passwordReset.findFirst({
          where: { token: legacyPlaintext, tokenHash: null },
          select: {
            id: true,
            userId: true,
            token: true,
            tokenHash: true,
            expires: true,
          },
        }),
      hashPassword,
      prepareSuccessResponse() {
        const response = NextResponse.json({
          message: PASSWORD_RESET_CONFIRM_SUCCESS_MESSAGE,
        });
        response.cookies.set("prepared-reset-session", "must-be-discarded", {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
        preparedCookie = response.headers.get("set-cookie");
        return response;
      },
      commitReset: (claim, preparedPasswordHash) =>
        commitPasswordResetConfirmation(
          observedDatabaseAdapter(worker, resolveWorker, rejectWorker),
          claim,
          preparedPasswordHash,
        ),
      reportFailure(failure) {
        failures.push(failure);
      },
    });

    confirmation = handler(
      trustedRequest(rawToken, "NovaLockLozinka2!"),
    );
    const started = await workerStarted;
    await waitForSpecificRowLock(observer, started.pid, blockerPid);

    const whileBlocked = await observer.$queryRaw<Array<{ at: Date }>>`
      SELECT clock_timestamp()::timestamptz(3) AS "at"
    `;
    assert.ok(whileBlocked[0]?.at instanceof Date);
    assert.ok(
      whileBlocked[0].at.getTime() < expiresAt.getTime(),
      "worker mora ući u row-lock wait pre isteka reset tokena",
    );

    const deadline = Date.now() + 5_000;
    let crossedExpiry = false;
    while (Date.now() < deadline) {
      const rows = await observer.$queryRaw<Array<{ at: Date }>>`
        SELECT clock_timestamp()::timestamptz(3) AS "at"
      `;
      const databaseNow = rows[0]?.at;
      assert.ok(databaseNow instanceof Date);
      if (databaseNow.getTime() >= expiresAt.getTime()) {
        crossedExpiry = true;
        break;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }
    assert.equal(
      crossedExpiry,
      true,
      "DB expiry granica nije dostignuta dok je PasswordReset lock držan",
    );

    releaseTokenLock();
    await lockerTransaction;
    const response = await confirmation;
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: PASSWORD_RESET_CONFIRM_INVALID_MESSAGE,
    });
    assert.equal(response.headers.get("set-cookie"), null);
    assert.match(
      preparedCookie ?? "",
      /prepared-reset-session=must-be-discarded/,
    );
    assert.deepEqual(failures, [{ stage: "COMMIT" }]);

    const [storedUser, storedReset] = await Promise.all([
      observer.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { passwordHash: true, updatedAt: true },
      }),
      observer.passwordReset.findUnique({
        where: { id: reset.id },
        select: { tokenHash: true, expires: true },
      }),
    ]);
    assert.equal(storedUser.passwordHash, oldPasswordHash);
    assert.equal(storedUser.updatedAt.getTime(), user.updatedAt.getTime());
    assert.equal(storedReset?.tokenHash, tokenHash);
    assert.equal(storedReset?.expires.getTime(), expiresAt.getTime());
  },
);
