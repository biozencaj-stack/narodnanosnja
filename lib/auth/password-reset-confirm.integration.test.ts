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

function failingPasswordUpdateAdapter(
  prisma: PrismaClient,
): PasswordResetConfirmDatabase {
  return {
    $transaction: (work) =>
      prisma.$transaction((transaction) =>
        work({
          passwordReset: {
            deleteMany: (input) =>
              transaction.passwordReset.deleteMany(input),
          },
          user: {
            async update() {
              throw new Error("Injected password update failure");
            },
          },
        }),
      ),
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
  resetAt: Date,
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
    async commitReset(claim, passwordHash, claimResetAt) {
      if (commitCounts) commitCounts.attempts += 1;
      await commitPasswordResetConfirmation(
        database,
        claim,
        passwordHash,
        claimResetAt,
      );
      if (commitCounts) commitCounts.winners += 1;
    },
    reportFailure(failure) {
      failures.push(failure);
    },
    now: () => resetAt,
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

    const barrier = createTwoWorkerBarrier();
    const hashFailures: PasswordResetConfirmFailure[] = [];
    const hashLookups = { hash: 0, legacy: 0 };
    const commitCounts = { attempts: 0, winners: 0 };
    const hashHandler = createDatabaseHandler(
      prisma,
      barrierDatabaseAdapter(prisma, barrier),
      resetAt,
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
      resetAt,
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
        failingPasswordUpdateAdapter(prisma),
        rollbackClaim,
        retryPasswordHash,
        resetAt,
      ),
      /Injected password update failure/,
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
      resetAt,
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
