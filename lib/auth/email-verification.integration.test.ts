import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
  "dva verify radnika mogu potrošiti isti token tačno jednom",
  { skip: !RUN_DATABASE_TESTS, timeout: 20_000 },
  async (testContext) => {
    assertSafeTestDatabase();

    const { prisma } = await import("@/lib/db");
    const {
      EmailVerificationConflictError,
      commitEmailVerification,
    } = await import("./email-verification");
    const runId = randomUUID();
    const email = `auth-verification-${runId}@example.invalid`;
    const primaryToken = `primary-${runId}`;
    const siblingToken = `sibling-${runId}`;
    const verifiedAt = new Date();

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: "integration-test-only",
        firstName: "Auth",
        lastName: "Verification",
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
        expires: new Date(verifiedAt.getTime() + 60_000),
      },
    });
    await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: siblingToken,
        expires: new Date(verifiedAt.getTime() + 60_000),
      },
    });

    const claim = {
      id: primary.id,
      userId: user.id,
      token: primaryToken,
    };
    const waitForBothWorkers = createTwoWorkerBarrier();
    const results = await Promise.allSettled([
      commitEmailVerification(
        withTransactionBarrier(prisma, waitForBothWorkers),
        claim,
        verifiedAt,
      ),
      commitEmailVerification(
        withTransactionBarrier(prisma, waitForBothWorkers),
        claim,
        verifiedAt,
      ),
    ]);

    const fulfilled = results.filter(
      (result) => result.status === "fulfilled",
    );
    const rejected = results.filter(
      (result) => result.status === "rejected",
    );
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(
      rejected[0]?.status === "rejected" &&
        rejected[0].reason instanceof EmailVerificationConflictError,
    );

    const [storedUser, remainingTokens] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { emailVerified: true },
      }),
      prisma.emailVerification.count({ where: { userId: user.id } }),
    ]);
    assert.equal(storedUser?.emailVerified?.getTime(), verifiedAt.getTime());
    assert.equal(remainingTokens, 0);
  },
);
