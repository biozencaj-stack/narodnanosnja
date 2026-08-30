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
      async commitVerification(claimVerifiedAt, verification) {
        commitAttempts += 1;
        const claim = createStoredEmailVerificationClaim(verification);
        assert.ok(claim);
        assert.equal(claim.credential.kind, "hash");
        await commitEmailVerification(
          withTransactionBarrier(prisma, waitForBothWorkers),
          claim,
          claimVerifiedAt,
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
      now: () => verifiedAt,
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
    assert.equal(storedUser?.emailVerified?.getTime(), verifiedAt.getTime());
    assert.equal(storedUser?.verificationEmailNextAllowedAt, null);
    assert.equal(storedUser?.verificationEmailResendWindowStartedAt, null);
    assert.equal(storedUser?.verificationEmailResendCount, null);
    assert.deepEqual(remainingTokens, []);
  },
);
