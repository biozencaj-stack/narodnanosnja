import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";

const RUN_DATABASE_TESTS =
  process.env.RUN_AUTH_VERIFICATION_DB_TESTS === "true";

function assertSafeTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL je obavezan za integration test email verifikacije.",
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
  "prefetch ostaje read-only, a dva POST radnika potroše isti token tačno jednom",
  { skip: !RUN_DATABASE_TESTS, timeout: 20_000 },
  async (testContext) => {
    assertSafeTestDatabase();

    const { prisma } = await import("@/lib/db");
    const {
      commitEmailVerification,
      createStoredEmailVerificationClaim,
    } = await import("./email-verification");
    const { hashCredentialToken } = await import("./credential-token");
    const { createEmailVerificationRouteHandlers } = await import(
      "./email-verification-route"
    );
    const { NextRequest, NextResponse } = await import("next/server");
    const runId = randomUUID();
    const email = `auth-verification-${runId}@example.invalid`;
    const primaryToken = randomBytes(32).toString("hex");
    const siblingToken = randomBytes(32).toString("hex");
    const primaryTokenHash = hashCredentialToken(
      "email-verification",
      primaryToken,
    );
    const siblingTokenHash = hashCredentialToken(
      "email-verification",
      siblingToken,
    );
    assert.ok(primaryTokenHash);
    assert.ok(siblingTokenHash);
    const verifiedAt = new Date();

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: "integration-test-only",
        firstName: "Auth",
        lastName: "Verification",
        emailVerificationLoginGraceUntil: new Date(
          verifiedAt.getTime() + 86_400_000,
        ),
        verificationEmailNextAllowedAt: new Date(
          verifiedAt.getTime() + 60_000,
        ),
        verificationEmailResendWindowStartedAt: verifiedAt,
        verificationEmailResendCount: 5,
      },
    });

    testContext.after(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: user.id } });
      } finally {
        await prisma.$disconnect();
      }
    });

    const primary = await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: primaryToken,
        tokenHash: primaryTokenHash,
        expires: new Date(verifiedAt.getTime() + 60_000),
      },
    });
    const sibling = await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: siblingToken,
        tokenHash: siblingTokenHash,
        expires: new Date(verifiedAt.getTime() + 60_000),
      },
    });

    const endpoint = `https://shop.example.test/api/auth/verify-email/${primaryToken}`;
    const context = () => ({
      params: Promise.resolve({ token: primaryToken }),
    });
    const request = (
      method: "GET" | "HEAD" | "POST",
      prefetch = false,
    ) =>
      new NextRequest(endpoint, {
        method,
        headers: {
          host: "shop.example.test",
          origin: "https://shop.example.test",
          ...(prefetch
            ? {
                purpose: "prefetch",
                "sec-purpose": "prefetch",
              }
            : {}),
        },
      });

    const [userBeforeReadOnlyRequests, tokensBeforeReadOnlyRequests] =
      await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { emailVerified: true, updatedAt: true },
        }),
        prisma.emailVerification.findMany({
          where: { userId: user.id },
          select: { id: true },
          orderBy: { id: "asc" },
        }),
      ]);

    let lookupCount = 0;
    let commitAttempts = 0;
    let commitWinners = 0;
    const lookedUpTokenIds: string[] = [];
    const failureStages: string[] = [];
    const waitForBothWorkers = createTwoWorkerBarrier();
    const handlers = createEmailVerificationRouteHandlers({
      getConfirmationUrl(token: string) {
        return `https://shop.example.test/verify-email/${token}`;
      },
      async findVerification(token: string) {
        lookupCount += 1;
        const tokenHash = hashCredentialToken("email-verification", token);
        assert.ok(tokenHash);
        const verification = await prisma.emailVerification.findUnique({
          where: { tokenHash },
        });
        if (verification) lookedUpTokenIds.push(verification.id);
        return verification;
      },
      async getCurrentSessionUserId() {
        return null;
      },
      async issueSessionToken() {
        return "integration-session-token";
      },
      prepareSuccessResponse(sessionToken: string) {
        const response = NextResponse.redirect(
          "https://shop.example.test/moj-nalog?verified=true",
          303,
        );
        response.cookies.set("integration-session", sessionToken, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
        return response;
      },
      async commitVerification(verification) {
        commitAttempts += 1;
        const claim = createStoredEmailVerificationClaim({
          ...verification,
          user,
        });
        assert.ok(claim);
        assert.equal(claim.credential.kind, "hash");
        await commitEmailVerification(
          withTransactionBarrier(prisma, waitForBothWorkers),
          claim,
        );
        commitWinners += 1;
      },
      untrustedWriteResponse() {
        return NextResponse.json({ error: "untrusted" }, { status: 403 });
      },
      invalidTokenResponse() {
        return NextResponse.json({ error: "invalid" }, { status: 409 });
      },
      expiredTokenResponse() {
        return NextResponse.json({ error: "expired" }, { status: 410 });
      },
      sessionMismatchResponse() {
        return NextResponse.json(
          { error: "session-mismatch" },
          { status: 409 },
        );
      },
      retryResponse() {
        return NextResponse.json({ error: "retry" }, { status: 503 });
      },
      reportFailure({ stage }) {
        failureStages.push(stage);
      },
    });

    const [getResponse, headResponse] = await Promise.all([
      handlers.GET(request("GET", true), context()),
      handlers.HEAD(request("HEAD", true), context()),
    ]);

    for (const response of [getResponse, headResponse]) {
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("set-cookie"), null);
    }
    assert.equal(lookupCount, 0);

    const [userAfterReadOnlyRequests, tokensAfterReadOnlyRequests] =
      await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { emailVerified: true, updatedAt: true },
        }),
        prisma.emailVerification.findMany({
          where: { userId: user.id },
          select: { id: true },
          orderBy: { id: "asc" },
        }),
      ]);

    assert.equal(userBeforeReadOnlyRequests.emailVerified, null);
    assert.equal(userAfterReadOnlyRequests.emailVerified, null);
    assert.equal(
      userAfterReadOnlyRequests.updatedAt.getTime(),
      userBeforeReadOnlyRequests.updatedAt.getTime(),
    );
    assert.deepEqual(
      tokensBeforeReadOnlyRequests.map(({ id }) => id),
      [primary.id, sibling.id].sort(),
    );
    assert.deepEqual(
      tokensAfterReadOnlyRequests.map(({ id }) => id),
      tokensBeforeReadOnlyRequests.map(({ id }) => id),
    );

    const responses = await Promise.all([
      handlers.POST(request("POST"), context()),
      handlers.POST(request("POST"), context()),
    ]);

    const successfulResponses = responses.filter(
      (response) =>
        response.status === 303 && response.headers.has("set-cookie"),
    );
    const failedResponses = responses.filter(
      (response) => response.status !== 303,
    );

    assert.equal(successfulResponses.length, 1);
    assert.match(
      successfulResponses[0]?.headers.get("set-cookie") ?? "",
      /integration-session=integration-session-token/,
    );
    assert.equal(failedResponses.length, 1);
    assert.equal(failedResponses[0]?.status, 409);
    assert.deepEqual(await failedResponses[0]?.json(), { error: "invalid" });
    assert.equal(failedResponses[0]?.headers.get("set-cookie"), null);
    assert.equal(lookupCount, 2);
    assert.deepEqual(lookedUpTokenIds, [primary.id, primary.id]);
    assert.equal(commitAttempts, 2);
    assert.equal(commitWinners, 1);
    assert.deepEqual(failureStages, ["COMMIT"]);

    const [storedUser, remainingTokens] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          emailVerified: true,
          emailVerificationLoginGraceUntil: true,
          verificationEmailNextAllowedAt: true,
          verificationEmailResendWindowStartedAt: true,
          verificationEmailResendCount: true,
        },
      }),
      prisma.emailVerification.findMany({
        where: { userId: user.id },
        select: { id: true },
      }),
    ]);
    assert.ok(storedUser?.emailVerified instanceof Date);
    assert.ok(
      storedUser.emailVerified.getTime() >= user.createdAt.getTime(),
    );
    assert.equal(storedUser?.emailVerificationLoginGraceUntil, null);
    assert.equal(storedUser?.verificationEmailNextAllowedAt, null);
    assert.equal(storedUser?.verificationEmailResendWindowStartedAt, null);
    assert.equal(storedUser?.verificationEmailResendCount, null);
    assert.deepEqual(remainingTokens, []);
  },
);

test(
  "verify meri DB vreme tek posle token lock wait-a i ne vraća pripremljeni cookie posle isteka",
  { skip: !RUN_DATABASE_TESTS, timeout: 30_000 },
  async (testContext) => {
    assertSafeTestDatabase();

    const { PrismaClient: RuntimePrismaClient } = await import(
      "@prisma/client"
    );
    const { prisma } = await import("@/lib/db");
    const {
      commitEmailVerification,
      createStoredEmailVerificationClaim,
    } = await import("./email-verification");
    const { hashCredentialToken } = await import("./credential-token");
    const { createEmailVerificationRouteHandlers } = await import(
      "./email-verification-route"
    );
    const { NextRequest, NextResponse } = await import("next/server");
    const locker = new RuntimePrismaClient();
    const worker = new RuntimePrismaClient();
    const runId = randomUUID();
    const email = `auth-verification-token-lock-${runId}@example.invalid`;
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashCredentialToken("email-verification", rawToken);
    assert.ok(tokenHash);

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
        email,
        passwordHash: "integration-token-lock-password",
        firstName: "Token",
        lastName: "Lock",
        emailVerificationLoginGraceUntil: new Date(Date.now() + 86_400_000),
        verificationEmailNextAllowedAt: new Date(Date.now() + 60_000),
        verificationEmailResendWindowStartedAt: new Date(),
        verificationEmailResendCount: 2,
      },
    });
    createdUserId = user.id;
    const createdVerification = await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: rawToken,
        tokenHash,
        expires: new Date(Date.now() + 60_000),
      },
    });

    const verification = await prisma.emailVerification.findUniqueOrThrow({
      where: { id: createdVerification.id },
      include: { user: true },
    });
    const userBeforeCommit = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        emailVerified: true,
        updatedAt: true,
        emailVerificationLoginGraceUntil: true,
        verificationEmailNextAllowedAt: true,
        verificationEmailResendWindowStartedAt: true,
        verificationEmailResendCount: true,
      },
    });

    let signalTokenLockAcquired: (state: {
      pid: number;
      expiresAt: Date;
    }) => void = () => undefined;
    const tokenLockAcquired = new Promise<{
      pid: number;
      expiresAt: Date;
    }>((resolve) => {
      signalTokenLockAcquired = resolve;
    });
    let releaseTokenLock: () => void = () => undefined;
    const tokenLockReleaseRequested = new Promise<void>((resolve) => {
      releaseTokenLock = resolve;
    });
    const lockerTransaction = locker.$transaction(
      async (transaction) => {
        const pidRows = await transaction.$queryRaw<Array<{ pid: number }>>`
          SELECT pg_backend_pid() AS "pid"
        `;
        const lockerPid = pidRows[0]?.pid;
        assert.equal(pidRows.length, 1);
        assert.equal(typeof lockerPid, "number");
        assert.ok(Number.isInteger(lockerPid));

        // Updating expiry acquires the exact token-row lock and starts a fresh
        // DB-clock boundary while all route dependencies are already prepared.
        await transaction.$executeRaw`
          UPDATE public."EmailVerification"
          SET "expires" =
            clock_timestamp()::timestamptz(3) + INTERVAL '4 seconds'
          WHERE "id" = ${verification.id}
        `;
        const locked = await transaction.$queryRaw<
          Array<{ id: string; expires: Date }>
        >`
          SELECT "id", "expires"
          FROM public."EmailVerification"
          WHERE "id" = ${verification.id}
        `;
        assert.equal(locked.length, 1);
        assert.equal(locked[0]?.id, verification.id);
        assert.ok(locked[0]?.expires instanceof Date);
        signalTokenLockAcquired({
          pid: lockerPid,
          expiresAt: locked[0].expires,
        });
        await tokenLockReleaseRequested;
      },
      { timeout: 10_000 },
    );

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
          return await worker.$transaction(
            async (transaction) => {
              const rows = await transaction.$queryRaw<Array<{ pid: number }>>`
                SELECT pg_backend_pid() AS "pid"
              `;
              const workerPid = rows[0]?.pid;
              if (
                rows.length !== 1 ||
                typeof workerPid !== "number" ||
                !Number.isInteger(workerPid)
              ) {
                throw new Error("Verify worker nema validan PostgreSQL PID");
              }
              resolveWorkerPid(workerPid);
              return callback(transaction);
            },
            { timeout: 10_000 },
          );
        } catch (error) {
          rejectWorkerPid(error);
          throw error;
        }
      },
    } as Pick<PrismaClient, "$transaction">;

    let issueCount = 0;
    let preparedCount = 0;
    let preparedCookieHeader: string | null = null;
    const failureStages: string[] = [];
    const handlers = createEmailVerificationRouteHandlers({
      getConfirmationUrl(token: string) {
        return `https://shop.example.test/verify-email/${token}`;
      },
      async findVerification(token: string) {
        const submittedHash = hashCredentialToken(
          "email-verification",
          token,
        );
        assert.equal(submittedHash, tokenHash);
        return verification;
      },
      async getCurrentSessionUserId() {
        return null;
      },
      async issueSessionToken() {
        issueCount += 1;
        return "prepared-expiry-session";
      },
      prepareSuccessResponse(sessionToken: string) {
        preparedCount += 1;
        const response = NextResponse.redirect(
          "https://shop.example.test/moj-nalog?verified=true",
          303,
        );
        response.cookies.set("integration-session", sessionToken, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
        });
        preparedCookieHeader = response.headers.get("set-cookie");
        return response;
      },
      async commitVerification(storedVerification) {
        const claim = createStoredEmailVerificationClaim(storedVerification);
        assert.ok(claim);
        await commitEmailVerification(observedDatabase, claim);
      },
      untrustedWriteResponse() {
        return NextResponse.json({ error: "untrusted" }, { status: 403 });
      },
      invalidTokenResponse() {
        return NextResponse.json({ error: "invalid" }, { status: 409 });
      },
      expiredTokenResponse() {
        return NextResponse.json({ error: "expired" }, { status: 410 });
      },
      sessionMismatchResponse() {
        return NextResponse.json(
          { error: "session-mismatch" },
          { status: 409 },
        );
      },
      retryResponse() {
        return NextResponse.json({ error: "retry" }, { status: 503 });
      },
      reportFailure({ stage }) {
        failureStages.push(stage);
      },
    });
    const request = new NextRequest(
      `https://shop.example.test/api/auth/verify-email/${rawToken}`,
      {
        method: "POST",
        headers: {
          host: "shop.example.test",
          origin: "https://shop.example.test",
        },
      },
    );
    const context = {
      params: Promise.resolve({ token: rawToken }),
    };

    let verificationResponsePromise: Promise<InstanceType<
      typeof NextResponse
    >> | null = null;
    let lockedExpiresAt: Date | null = null;
    try {
      const { pid: lockerPid, expiresAt } = await Promise.race([
        tokenLockAcquired,
        lockerTransaction.then(() => {
          throw new Error("Token lock je pušten pre signala testa");
        }),
      ]);
      lockedExpiresAt = expiresAt;

      verificationResponsePromise = handlers.POST(request, context);
      const workerPid = await workerPidReady;
      const lockWaitDeadline = Date.now() + 2_000;
      let observedTokenLockWait = false;
      while (Date.now() < lockWaitDeadline) {
        const activity = await prisma.$queryRaw<
          Array<{
            waitEventType: string | null;
            blockingPids: number[];
          }>
        >`
          SELECT
            "wait_event_type" AS "waitEventType",
            pg_catalog.pg_blocking_pids("pid") AS "blockingPids"
          FROM pg_catalog.pg_stat_activity
          WHERE "pid" = ${workerPid}
        `;
        const workerActivity = activity[0];
        if (
          workerActivity?.waitEventType === "Lock" &&
          workerActivity.blockingPids.includes(lockerPid)
        ) {
          observedTokenLockWait = true;
          break;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(
        observedTokenLockWait,
        true,
        "verify worker nije primećen u token-row PostgreSQL lock wait stanju",
      );

      const beforeExpiryClock = await prisma.$queryRaw<Array<{ at: Date }>>`
        SELECT clock_timestamp()::timestamptz(3) AS "at"
      `;
      const databaseTimeWhileBlocked = beforeExpiryClock[0]?.at;
      assert.ok(databaseTimeWhileBlocked instanceof Date);
      assert.ok(
        databaseTimeWhileBlocked.getTime() < expiresAt.getTime(),
        "verify worker mora biti blokiran pre DB expiry granice",
      );

      const expiryDeadline = Date.now() + 5_000;
      let crossedExpiryBoundary = false;
      while (Date.now() < expiryDeadline) {
        const clockRows = await prisma.$queryRaw<Array<{ at: Date }>>`
          SELECT clock_timestamp()::timestamptz(3) AS "at"
        `;
        const databaseNow = clockRows[0]?.at;
        assert.ok(databaseNow instanceof Date);
        if (databaseNow.getTime() >= expiresAt.getTime()) {
          crossedExpiryBoundary = true;
          break;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(
        crossedExpiryBoundary,
        true,
        "PostgreSQL expiry granica nije dostignuta dok je token lock držan",
      );

      releaseTokenLock();
      await lockerTransaction;
      const response = await verificationResponsePromise;
      assert.equal(response.status, 410);
      assert.deepEqual(await response.json(), { error: "expired" });
      assert.equal(response.headers.get("set-cookie"), null);
    } finally {
      releaseTokenLock();
      await Promise.allSettled([
        lockerTransaction,
        ...(verificationResponsePromise
          ? [verificationResponsePromise]
          : []),
      ]);
    }

    assert.equal(issueCount, 1);
    assert.equal(preparedCount, 1);
    assert.match(
      preparedCookieHeader ?? "",
      /integration-session=prepared-expiry-session/,
    );
    assert.deepEqual(failureStages, []);

    const [storedUser, storedTokens] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: {
          emailVerified: true,
          updatedAt: true,
          emailVerificationLoginGraceUntil: true,
          verificationEmailNextAllowedAt: true,
          verificationEmailResendWindowStartedAt: true,
          verificationEmailResendCount: true,
        },
      }),
      prisma.emailVerification.findMany({
        where: { userId: user.id },
        select: { id: true, token: true, tokenHash: true, expires: true },
      }),
    ]);
    assert.equal(storedUser.emailVerified, null);
    assert.equal(
      storedUser.updatedAt.getTime(),
      userBeforeCommit.updatedAt.getTime(),
    );
    assert.equal(
      storedUser.emailVerificationLoginGraceUntil?.getTime(),
      userBeforeCommit.emailVerificationLoginGraceUntil?.getTime(),
    );
    assert.equal(
      storedUser.verificationEmailNextAllowedAt?.getTime(),
      userBeforeCommit.verificationEmailNextAllowedAt?.getTime(),
    );
    assert.equal(
      storedUser.verificationEmailResendWindowStartedAt?.getTime(),
      userBeforeCommit.verificationEmailResendWindowStartedAt?.getTime(),
    );
    assert.equal(
      storedUser.verificationEmailResendCount,
      userBeforeCommit.verificationEmailResendCount,
    );
    assert.ok(lockedExpiresAt instanceof Date);
    assert.deepEqual(storedTokens, [
      {
        id: verification.id,
        token: rawToken,
        tokenHash,
        expires: lockedExpiresAt,
      },
    ]);
  },
);

test(
  "promena role ili password snapshot-a posle pripreme cookie-ja odbija verify commit",
  { skip: !RUN_DATABASE_TESTS, timeout: 30_000 },
  async (testContext) => {
    assertSafeTestDatabase();

    const { PrismaClient: RuntimePrismaClient } = await import(
      "@prisma/client"
    );
    const { prisma } = await import("@/lib/db");
    const {
      commitEmailVerification,
      createStoredEmailVerificationClaim,
    } = await import("./email-verification");
    const { hashCredentialToken } = await import("./credential-token");
    const { createEmailVerificationRouteHandlers } = await import(
      "./email-verification-route"
    );
    const { NextRequest, NextResponse } = await import("next/server");
    const mutationWorker = new RuntimePrismaClient();
    const createdUserIds: string[] = [];

    testContext.after(async () => {
      try {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
      } finally {
        await Promise.allSettled([
          prisma.$disconnect(),
          mutationWorker.$disconnect(),
        ]);
      }
    });

    const scenarios = ["role", "passwordHash"] as const;
    for (const scenario of scenarios) {
      const runId = randomUUID();
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashCredentialToken("email-verification", rawToken);
      assert.ok(tokenHash);
      const originalPasswordHash = `snapshot-original-${runId}`;
      const rotatedPasswordHash = `snapshot-rotated-${runId}`;
      const originalGraceUntil = new Date(Date.now() + 86_400_000);
      const user = await prisma.user.create({
        data: {
          email: `auth-verification-snapshot-${scenario}-${runId}@example.invalid`,
          passwordHash: originalPasswordHash,
          firstName: "Snapshot",
          lastName: scenario,
          emailVerificationLoginGraceUntil: originalGraceUntil,
        },
      });
      createdUserIds.push(user.id);
      const verification = await prisma.emailVerification.create({
        data: {
          userId: user.id,
          token: rawToken,
          tokenHash,
          expires: new Date(Date.now() + 60_000),
        },
      });

      let signalResponsePrepared: () => void = () => undefined;
      const responsePrepared = new Promise<void>((resolve) => {
        signalResponsePrepared = resolve;
      });
      let continueAfterMutation: () => void = () => undefined;
      const mutationCompleted = new Promise<void>((resolve) => {
        continueAfterMutation = resolve;
      });
      let preparedCookieHeader: string | null = null;
      let lookupCount = 0;
      let issueCount = 0;
      let preparationCount = 0;
      let commitAttempts = 0;
      const failureStages: string[] = [];

      const handlers = createEmailVerificationRouteHandlers({
        getConfirmationUrl(token: string) {
          return `https://shop.example.test/verify-email/${token}`;
        },
        async findVerification(token: string) {
          lookupCount += 1;
          const submittedHash = hashCredentialToken(
            "email-verification",
            token,
          );
          assert.equal(submittedHash, tokenHash);
          return prisma.emailVerification.findUnique({
            where: { tokenHash },
            include: { user: true },
          });
        },
        async getCurrentSessionUserId() {
          return null;
        },
        async issueSessionToken() {
          issueCount += 1;
          return `prepared-${scenario}-session`;
        },
        async prepareSuccessResponse(sessionToken: string) {
          preparationCount += 1;
          const response = NextResponse.redirect(
            "https://shop.example.test/moj-nalog?verified=true",
            303,
          );
          response.cookies.set("integration-session", sessionToken, {
            httpOnly: true,
            sameSite: "lax",
            path: "/",
          });
          preparedCookieHeader = response.headers.get("set-cookie");
          signalResponsePrepared();
          await mutationCompleted;
          return response;
        },
        async commitVerification(storedVerification) {
          commitAttempts += 1;
          const claim = createStoredEmailVerificationClaim(storedVerification);
          assert.ok(claim);
          await commitEmailVerification(prisma, claim);
        },
        untrustedWriteResponse() {
          return NextResponse.json({ error: "untrusted" }, { status: 403 });
        },
        invalidTokenResponse() {
          return NextResponse.json({ error: "invalid" }, { status: 409 });
        },
        expiredTokenResponse() {
          return NextResponse.json({ error: "expired" }, { status: 410 });
        },
        sessionMismatchResponse() {
          return NextResponse.json(
            { error: "session-mismatch" },
            { status: 409 },
          );
        },
        retryResponse() {
          return NextResponse.json({ error: "retry" }, { status: 503 });
        },
        reportFailure({ stage }) {
          failureStages.push(stage);
        },
      });
      const request = new NextRequest(
        `https://shop.example.test/api/auth/verify-email/${rawToken}`,
        {
          method: "POST",
          headers: {
            host: "shop.example.test",
            origin: "https://shop.example.test",
          },
        },
      );
      const context = {
        params: Promise.resolve({ token: rawToken }),
      };

      const responsePromise = handlers.POST(request, context);
      try {
        await Promise.race([
          responsePrepared,
          responsePromise.then(() => {
            throw new Error(
              `Verify ${scenario} scenario je završen pre pripreme odgovora`,
            );
          }),
        ]);

        if (scenario === "role") {
          await mutationWorker.user.update({
            where: { id: user.id },
            data: { role: "ADMIN" },
          });
        } else {
          await mutationWorker.user.update({
            where: { id: user.id },
            data: { passwordHash: rotatedPasswordHash },
          });
        }
        continueAfterMutation();

        const response = await responsePromise;
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), { error: "invalid" });
        assert.equal(response.headers.get("set-cookie"), null);
      } finally {
        continueAfterMutation();
        await Promise.allSettled([responsePromise]);
      }

      assert.equal(lookupCount, 1);
      assert.equal(issueCount, 1);
      assert.equal(preparationCount, 1);
      assert.equal(commitAttempts, 1);
      assert.match(
        preparedCookieHeader ?? "",
        new RegExp(`integration-session=prepared-${scenario}-session`),
      );
      assert.deepEqual(failureStages, ["COMMIT"]);

      const [storedUser, storedTokens] = await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: {
            role: true,
            passwordHash: true,
            emailVerified: true,
            emailVerificationLoginGraceUntil: true,
          },
        }),
        prisma.emailVerification.findMany({
          where: { userId: user.id },
          select: { id: true, token: true, tokenHash: true },
        }),
      ]);
      assert.equal(storedUser.emailVerified, null);
      assert.equal(
        storedUser.emailVerificationLoginGraceUntil?.getTime(),
        originalGraceUntil.getTime(),
      );
      if (scenario === "role") {
        assert.equal(storedUser.role, "ADMIN");
        assert.equal(storedUser.passwordHash, originalPasswordHash);
      } else {
        assert.equal(storedUser.role, "CUSTOMER");
        assert.equal(storedUser.passwordHash, rotatedPasswordHash);
      }
      assert.deepEqual(storedTokens, [
        {
          id: verification.id,
          token: rawToken,
          tokenHash,
        },
      ]);
    }
  },
);
