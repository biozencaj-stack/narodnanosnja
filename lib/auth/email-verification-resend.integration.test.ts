import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";

const RUN_DATABASE_TESTS =
  process.env.RUN_EMAIL_VERIFICATION_RESEND_DB_TESTS === "true";

function assertSafeTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL je obavezan za integration test resend verifikacije.",
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
    databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
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
  const bothWorkersArrived = new Promise<void>((resolve) => {
    release = resolve;
  });

  return async () => {
    arrived += 1;
    if (arrived === 2) release();
    await bothWorkersArrived;
  };
}

function withTransactionBarrier(
  database: PrismaClient,
  waitForBothWorkers: () => Promise<void>,
): Pick<PrismaClient, "$transaction"> {
  const interactiveTransaction = async <T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> =>
    database.$transaction(async (transaction) => {
      await waitForBothWorkers();
      return callback(transaction);
    });

  return {
    $transaction:
      interactiveTransaction as PrismaClient["$transaction"],
  };
}

test(
  "dva resend radnika atomski izdaju tačno jedan novi token",
  { skip: !RUN_DATABASE_TESTS, timeout: 20_000 },
  async (testContext) => {
    assertSafeTestDatabase();

    const { prisma } = await import("@/lib/db");
    const {
      EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
      EMAIL_VERIFICATION_RESEND_MAX_EMAILS_PER_WINDOW,
      EMAIL_VERIFICATION_RESEND_TOKEN_LIFETIME_MS,
      commitEmailVerificationResend,
    } = await import("./email-verification-resend");
    const { hashCredentialToken } = await import("./credential-token");
    const runId = randomUUID();
    const oldToken = randomBytes(32).toString("hex");
    const candidateTokens = [
      randomBytes(32).toString("hex"),
      randomBytes(32).toString("hex"),
    ];
    const oldTokenHash = hashCredentialToken(
      "email-verification",
      oldToken,
    );
    const candidateHashes = candidateTokens.map((token) =>
      hashCredentialToken("email-verification", token),
    );
    const quotaWindowStartedAt = new Date(Date.now() - 1_000);
    assert.ok(oldTokenHash);
    assert.ok(candidateHashes[0]);
    assert.ok(candidateHashes[1]);

    const user = await prisma.user.create({
      data: {
        email: `verification-resend-concurrency-${runId}@example.invalid`,
        passwordHash: "integration-test-only",
        firstName: "Resend",
        lastName: "Concurrency",
        verificationEmailResendWindowStartedAt: quotaWindowStartedAt,
        verificationEmailResendCount:
          EMAIL_VERIFICATION_RESEND_MAX_EMAILS_PER_WINDOW - 1,
      },
    });
    testContext.after(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: user.id } });
      } finally {
        await prisma.$disconnect();
      }
    });
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: oldToken,
        tokenHash: oldTokenHash,
        expires: new Date(Date.now() + 60_000),
      },
    });

    const waitForBothWorkers = createTwoWorkerBarrier();
    const database = withTransactionBarrier(prisma, waitForBothWorkers);
    const startedAt = new Date();
    const results = await Promise.all(
      candidateTokens.map((token, index) =>
        commitEmailVerificationResend(database, {
          userId: user.id,
          expectedEmail: user.email,
          legacyPlaintextToken: token,
          tokenHash: candidateHashes[index]!,
        }),
      ),
    );
    const finishedAt = new Date();

    assert.equal(results.filter(Boolean).length, 1);
    const winningIndex = results.findIndex(Boolean);
    const [storedUser, storedTokens] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          verificationEmailNextAllowedAt: true,
          verificationEmailResendWindowStartedAt: true,
          verificationEmailResendCount: true,
        },
      }),
      prisma.emailVerification.findMany({
        where: { userId: user.id },
        select: { token: true, tokenHash: true, expires: true },
      }),
    ]);

    assert.ok(storedUser.verificationEmailNextAllowedAt);
    assert.equal(
      storedUser.verificationEmailResendWindowStartedAt?.getTime(),
      quotaWindowStartedAt.getTime(),
    );
    assert.equal(
      storedUser.verificationEmailResendCount,
      EMAIL_VERIFICATION_RESEND_MAX_EMAILS_PER_WINDOW,
    );
    assert.equal(storedTokens.length, 2);
    assert.equal(
      storedTokens.some(
        ({ token, tokenHash }) =>
          token === oldToken && tokenHash === oldTokenHash,
      ),
      true,
    );
    const issuedToken = storedTokens.find(
      ({ token, tokenHash }) =>
        token === candidateTokens[winningIndex] &&
        tokenHash === candidateHashes[winningIndex],
    );
    assert.ok(issuedToken);
    assert.ok(
      storedUser.verificationEmailNextAllowedAt.getTime() >=
        startedAt.getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
    );
    assert.ok(
      storedUser.verificationEmailNextAllowedAt.getTime() <=
        finishedAt.getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
    );
    assert.equal(
      issuedToken.expires.getTime() -
        storedUser.verificationEmailNextAllowedAt.getTime(),
      EMAIL_VERIFICATION_RESEND_TOKEN_LIFETIME_MS -
        EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
    );

    const quotaRejectedToken = randomBytes(32).toString("hex");
    const quotaRejectedHash = hashCredentialToken(
      "email-verification",
      quotaRejectedToken,
    );
    assert.ok(quotaRejectedHash);
    const rejectedAtCooldownBoundary = await commitEmailVerificationResend(
      prisma,
      {
        userId: user.id,
        expectedEmail: user.email,
        legacyPlaintextToken: quotaRejectedToken,
        tokenHash: quotaRejectedHash,
      },
      () => storedUser.verificationEmailNextAllowedAt!,
    );
    assert.equal(rejectedAtCooldownBoundary, false);

    const [quotaState, tokensAfterRejection] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { verificationEmailResendCount: true },
      }),
      prisma.emailVerification.findMany({
        where: { userId: user.id },
        select: { tokenHash: true },
      }),
    ]);
    assert.equal(
      quotaState.verificationEmailResendCount,
      EMAIL_VERIFICATION_RESEND_MAX_EMAILS_PER_WINDOW,
    );
    assert.equal(
      tokensAfterRejection.some(
        ({ tokenHash }) => tokenHash === quotaRejectedHash,
      ),
      false,
    );
    assert.equal(tokensAfterRejection.length, storedTokens.length);
  },
);

test(
  "resend meri cooldown i token TTL DB satom tek nakon čekanja na User lock",
  { skip: !RUN_DATABASE_TESTS, timeout: 20_000 },
  async (testContext) => {
    assertSafeTestDatabase();

    const { PrismaClient: RuntimePrismaClient } = await import(
      "@prisma/client"
    );
    const { prisma } = await import("@/lib/db");
    const {
      EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
      EMAIL_VERIFICATION_RESEND_TOKEN_LIFETIME_MS,
      commitEmailVerificationResend,
    } = await import("./email-verification-resend");
    const { hashCredentialToken } = await import("./credential-token");
    const locker = new RuntimePrismaClient();
    const worker = new RuntimePrismaClient();
    const runId = randomUUID();
    const oldToken = randomBytes(32).toString("hex");
    const newToken = randomBytes(32).toString("hex");
    const oldTokenHash = hashCredentialToken(
      "email-verification",
      oldToken,
    );
    const newTokenHash = hashCredentialToken(
      "email-verification",
      newToken,
    );
    assert.ok(oldTokenHash);
    assert.ok(newTokenHash);

    let createdUserId: string | null = null;
    testContext.after(async () => {
      try {
        if (createdUserId) {
          await prisma.user.deleteMany({ where: { id: createdUserId } });
        }
      } finally {
        await Promise.allSettled([
          prisma.$disconnect(),
          locker.$disconnect(),
          worker.$disconnect(),
        ]);
      }
    });
    const user = await prisma.user.create({
      data: {
        email: `verification-resend-lock-clock-${runId}@example.invalid`,
        passwordHash: "integration-test-only",
        firstName: "Lock",
        lastName: "Clock",
      },
    });
    createdUserId = user.id;
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: oldToken,
        tokenHash: oldTokenHash,
        expires: new Date(Date.now() + 60_000),
      },
    });

    let signalLockAcquired: () => void = () => undefined;
    const lockAcquired = new Promise<void>((resolve) => {
      signalLockAcquired = resolve;
    });
    let releaseUserLock: () => void = () => undefined;
    const userLockReleaseRequested = new Promise<void>((resolve) => {
      releaseUserLock = resolve;
    });
    const lockerTransaction = locker.$transaction(async (transaction) => {
      const locked = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM public."User"
        WHERE "id" = ${user.id}
        FOR UPDATE
      `;
      assert.deepEqual(locked, [{ id: user.id }]);
      signalLockAcquired();
      await userLockReleaseRequested;
    });

    let resolveWorkerPid: (pid: number) => void = () => undefined;
    let rejectWorkerPid: (error: unknown) => void = () => undefined;
    const workerPidReady = new Promise<number>((resolve, reject) => {
      resolveWorkerPid = resolve;
      rejectWorkerPid = reject;
    });
    const observedDatabase = {
      $transaction: async <T>(
        callback: (transaction: Prisma.TransactionClient) => Promise<T>,
      ): Promise<T> => {
        try {
          return await worker.$transaction(async (transaction) => {
            const rows = await transaction.$queryRaw<Array<{ pid: number }>>`
              SELECT pg_backend_pid() AS "pid"
            `;
            const pid = rows[0]?.pid;
            if (
              rows.length !== 1 ||
              typeof pid !== "number" ||
              !Number.isInteger(pid)
            ) {
              throw new Error("Resend worker nema validan PostgreSQL PID");
            }
            resolveWorkerPid(pid);
            return callback(transaction);
          });
        } catch (error) {
          rejectWorkerPid(error);
          throw error;
        }
      },
    } as Pick<PrismaClient, "$transaction">;

    let resendPromise: Promise<boolean> | null = null;
    try {
      await Promise.race([
        lockAcquired,
        lockerTransaction.then(() => {
          throw new Error("User lock je pušten pre signala testa");
        }),
      ]);

      resendPromise = commitEmailVerificationResend(observedDatabase, {
        userId: user.id,
        expectedEmail: user.email,
        legacyPlaintextToken: newToken,
        tokenHash: newTokenHash,
      });
      const workerPid = await workerPidReady;

      const waitDeadline = Date.now() + 2_000;
      let observedLockWait = false;
      while (Date.now() < waitDeadline) {
        const activity = await prisma.$queryRaw<
          Array<{ waitEventType: string | null }>
        >`
          SELECT "wait_event_type" AS "waitEventType"
          FROM pg_catalog.pg_stat_activity
          WHERE "pid" = ${workerPid}
        `;
        if (activity[0]?.waitEventType === "Lock") {
          observedLockWait = true;
          break;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(
        observedLockWait,
        true,
        "resend worker nije primećen u PostgreSQL lock wait stanju",
      );

      // Make transaction-start time observably older than the lock-release
      // boundary. An implementation that reads CURRENT_TIMESTAMP before the
      // lock will therefore fail the lower-bound assertions below.
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      const releaseClock = await prisma.$queryRaw<Array<{ at: Date }>>`
        SELECT clock_timestamp() AS "at"
      `;
      const releasedAt = releaseClock[0]?.at;
      assert.ok(releasedAt instanceof Date);

      releaseUserLock();
      await lockerTransaction;
      assert.equal(await resendPromise, true);

      const completionClock = await prisma.$queryRaw<Array<{ at: Date }>>`
        SELECT clock_timestamp() AS "at"
      `;
      const completedAt = completionClock[0]?.at;
      assert.ok(completedAt instanceof Date);

      const [storedUser, storedTokens] = await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { verificationEmailNextAllowedAt: true },
        }),
        prisma.emailVerification.findMany({
          where: { userId: user.id },
          select: { token: true, tokenHash: true, expires: true },
        }),
      ]);
      const nextAllowedAt = storedUser.verificationEmailNextAllowedAt;
      assert.ok(nextAllowedAt instanceof Date);
      assert.equal(storedTokens.length, 2);
      assert.equal(
        storedTokens.some(
          ({ token, tokenHash }) =>
            token === oldToken && tokenHash === oldTokenHash,
        ),
        true,
      );
      const issuedToken = storedTokens.find(
        ({ token, tokenHash }) =>
          token === newToken && tokenHash === newTokenHash,
      );
      assert.ok(issuedToken);
      const tokenExpiresAt = issuedToken.expires;
      assert.ok(tokenExpiresAt instanceof Date);

      assert.ok(
        nextAllowedAt.getTime() >=
          releasedAt.getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
      );
      assert.ok(
        nextAllowedAt.getTime() <=
          completedAt.getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
      );
      assert.ok(
        tokenExpiresAt.getTime() >=
          releasedAt.getTime() + EMAIL_VERIFICATION_RESEND_TOKEN_LIFETIME_MS,
      );
      assert.ok(
        tokenExpiresAt.getTime() <=
          completedAt.getTime() +
            EMAIL_VERIFICATION_RESEND_TOKEN_LIFETIME_MS,
      );
      assert.equal(
        tokenExpiresAt.getTime() - nextAllowedAt.getTime(),
        EMAIL_VERIFICATION_RESEND_TOKEN_LIFETIME_MS -
          EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
      );
    } finally {
      releaseUserLock();
      await Promise.allSettled([
        lockerTransaction,
        ...(resendPromise ? [resendPromise] : []),
      ]);
    }
  },
);

test(
  "verify ostaje uspešan kada resend prvi osvoji User lock i sačuva stari link",
  { skip: !RUN_DATABASE_TESTS, timeout: 20_000 },
  async (testContext) => {
    assertSafeTestDatabase();

    const { prisma } = await import("@/lib/db");
    const {
      commitEmailVerification,
      createStoredEmailVerificationClaim,
    } = await import("./email-verification");
    const { commitEmailVerificationResend } = await import(
      "./email-verification-resend"
    );
    const { hashCredentialToken } = await import("./credential-token");
    const runId = randomUUID();
    const oldToken = randomBytes(32).toString("hex");
    const newToken = randomBytes(32).toString("hex");
    const oldTokenHash = hashCredentialToken(
      "email-verification",
      oldToken,
    );
    const newTokenHash = hashCredentialToken(
      "email-verification",
      newToken,
    );
    assert.ok(oldTokenHash);
    assert.ok(newTokenHash);
    const raceAt = new Date();

    const user = await prisma.user.create({
      data: {
        email: `verification-resend-race-${runId}@example.invalid`,
        passwordHash: "integration-test-only",
        firstName: "Verify",
        lastName: "ResendRace",
      },
    });
    testContext.after(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: user.id } });
      } finally {
        await prisma.$disconnect();
      }
    });
    const oldVerification = await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: oldToken,
        tokenHash: oldTokenHash,
        expires: new Date(raceAt.getTime() + 60_000),
      },
    });
    const claim = createStoredEmailVerificationClaim({
      ...oldVerification,
      user,
    });
    assert.ok(claim);

    let signalResendLockAcquired: () => void = () => undefined;
    const resendLockAcquired = new Promise<void>((resolve) => {
      signalResendLockAcquired = resolve;
    });
    let releaseResendClock: () => void = () => undefined;
    const resendClockReleaseRequested = new Promise<void>((resolve) => {
      releaseResendClock = resolve;
    });
    const resentPromise = commitEmailVerificationResend(
      prisma,
      {
        userId: user.id,
        expectedEmail: user.email,
        legacyPlaintextToken: newToken,
        tokenHash: newTokenHash,
      },
      async () => {
        // commitEmailVerificationResend invokes its clock only after taking the
        // User FOR UPDATE lock. Hold that lock while verify starts, then force
        // resend to commit first. If resend deletes the old sibling, verify
        // must fail and this regression test catches it.
        signalResendLockAcquired();
        await resendClockReleaseRequested;
        return raceAt;
      },
    );

    let verifyPromise: Promise<boolean> | null = null;
    try {
      await Promise.race([
        resendLockAcquired,
        resentPromise.then(() => {
          throw new Error("Resend je završen pre signala da je User lock uzet");
        }),
      ]);
      verifyPromise = commitEmailVerification(prisma, claim).then(
        () => true,
      );
      releaseResendClock();
      const [resent, verified] = await Promise.all([
        resentPromise,
        verifyPromise,
      ]);
      assert.equal(resent, true);
      assert.equal(verified, true);
    } finally {
      releaseResendClock();
      await Promise.allSettled([
        resentPromise,
        ...(verifyPromise ? [verifyPromise] : []),
      ]);
    }
    const [storedUser, storedTokens] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          emailVerified: true,
          verificationEmailNextAllowedAt: true,
          verificationEmailResendWindowStartedAt: true,
          verificationEmailResendCount: true,
        },
      }),
      prisma.emailVerification.findMany({
        where: { userId: user.id },
        select: { token: true, tokenHash: true },
      }),
    ]);

    assert.equal(storedUser.emailVerified?.getTime(), raceAt.getTime());
    assert.equal(storedUser.verificationEmailNextAllowedAt, null);
    assert.equal(storedUser.verificationEmailResendWindowStartedAt, null);
    assert.equal(storedUser.verificationEmailResendCount, null);
    assert.deepEqual(storedTokens, []);
  },
);

test(
  "cooldown granica je uključiva, a neuspešan token insert vraća User i stari token",
  { skip: !RUN_DATABASE_TESTS, timeout: 20_000 },
  async (testContext) => {
    assertSafeTestDatabase();

    const { prisma } = await import("@/lib/db");
    const { commitEmailVerificationResend } = await import(
      "./email-verification-resend"
    );
    const { hashCredentialToken } = await import("./credential-token");
    const runId = randomUUID();
    const boundary = new Date();
    const oldToken = randomBytes(32).toString("hex");
    const attemptedToken = randomBytes(32).toString("hex");
    const collisionToken = randomBytes(32).toString("hex");
    const oldTokenHash = hashCredentialToken(
      "email-verification",
      oldToken,
    );
    const collisionTokenHash = hashCredentialToken(
      "email-verification",
      collisionToken,
    );
    assert.ok(oldTokenHash);
    assert.ok(collisionTokenHash);

    const [targetUser, collisionUser] = await Promise.all([
      prisma.user.create({
        data: {
          email: `verification-resend-boundary-${runId}@example.invalid`,
          passwordHash: "integration-test-only",
          firstName: "Boundary",
          lastName: "Rollback",
          verificationEmailNextAllowedAt: boundary,
        },
      }),
      prisma.user.create({
        data: {
          email: `verification-resend-collision-${runId}@example.invalid`,
          passwordHash: "integration-test-only",
          firstName: "Collision",
          lastName: "Owner",
        },
      }),
    ]);
    testContext.after(async () => {
      try {
        await prisma.user.deleteMany({
          where: { id: { in: [targetUser.id, collisionUser.id] } },
        });
      } finally {
        await prisma.$disconnect();
      }
    });
    const originalVerification = await prisma.emailVerification.create({
      data: {
        userId: targetUser.id,
        token: oldToken,
        tokenHash: oldTokenHash,
        expires: new Date(boundary.getTime() + 60_000),
      },
    });
    await prisma.emailVerification.create({
      data: {
        userId: collisionUser.id,
        token: collisionToken,
        tokenHash: collisionTokenHash,
        expires: new Date(boundary.getTime() + 60_000),
      },
    });

    await assert.rejects(
      commitEmailVerificationResend(
        prisma,
        {
          userId: targetUser.id,
          expectedEmail: targetUser.email,
          legacyPlaintextToken: attemptedToken,
          tokenHash: collisionTokenHash,
        },
        () => boundary,
      ),
    );

    const [storedUser, storedTokens] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: targetUser.id },
        select: {
          verificationEmailNextAllowedAt: true,
          verificationEmailResendWindowStartedAt: true,
          verificationEmailResendCount: true,
        },
      }),
      prisma.emailVerification.findMany({
        where: { userId: targetUser.id },
        select: { id: true, token: true, tokenHash: true },
      }),
    ]);
    assert.equal(
      storedUser.verificationEmailNextAllowedAt?.getTime(),
      boundary.getTime(),
    );
    assert.equal(storedUser.verificationEmailResendWindowStartedAt, null);
    assert.equal(storedUser.verificationEmailResendCount, null);
    assert.deepEqual(storedTokens, [
      {
        id: originalVerification.id,
        token: oldToken,
        tokenHash: oldTokenHash,
      },
    ]);
  },
);
