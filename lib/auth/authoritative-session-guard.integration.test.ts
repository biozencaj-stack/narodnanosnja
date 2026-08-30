import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { JWT } from "next-auth/jwt";
import type { Prisma } from "@prisma/client";
import { createAuthoritativeSessionDatabase } from "./authoritative-session-database";
import { createAuthoritativeSessionGuard } from "./authoritative-session-guard";
import { AUTH_SESSION_COOKIE_BASE_NAMES } from "./config";
import { normalizeEmailAddress } from "./email-address";
import {
  createAuthSessionClaimsV2,
  generateAuthSessionSid,
} from "./session-claims";
import { decodeAuthSessionJwt, encodeAuthSessionJwt } from "./session-jwt";

const RUN_DATABASE_TESTS = process.env.RUN_AUTH_SESSION_DB_TESTS === "true";
const SESSION_SECRET = "authoritative-guard-secret-at-least-32-bytes";

function assertSafeTestDatabase(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() !== databaseUrl) {
    throw new Error("DATABASE_URL je obavezan za guard integration test.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nije validna URL adresa.");
  }
  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error("Guard integration test zahteva PostgreSQL.");
  }
  if (
    !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(
      parsedUrl.hostname.toLowerCase(),
    )
  ) {
    throw new Error("Guard integration test zahteva loopback PostgreSQL.");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("Naziv guard test baze nije validan.");
  }
  if (
    !databaseName ||
    databaseName.includes("/") ||
    !/(?:^|[_-])(?:e2e|test|provera)(?:$|[_-])/i.test(databaseName) ||
    /(?:^|[_-])(?:prod|production|live)(?:$|[_-])/i.test(databaseName)
  ) {
    throw new Error("Guard integration test je odbijen van test baze.");
  }
  return databaseName;
}

test(
  "authoritative guard projects current DB principal and exact revoke becomes anonymous",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    const expectedDatabaseName = assertSafeTestDatabase();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    let userId: string | null = null;

    testContext.after(async () => {
      try {
        if (userId) await prisma.user.delete({ where: { id: userId } });
      } finally {
        await prisma.$disconnect();
      }
    });

    const identity = await prisma.$queryRaw<Array<{ databaseName: string }>>`
      SELECT current_database() AS "databaseName"
    `;
    assert.deepEqual(identity, [{ databaseName: expectedDatabaseName }]);

    const email = `g${randomUUID().replaceAll("-", "")}@e.test`;
    assert.equal(normalizeEmailAddress(email), email);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: "authoritative-guard-integration-not-used",
        firstName: "Before",
        lastName: "Guard",
        role: "CUSTOMER",
      },
      select: { id: true, createdAt: true },
    });
    userId = user.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: user.createdAt },
      select: { id: true },
    });

    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SET LOCAL TIME ZONE 'UTC'
      `;
      const timeZone = await transaction.$queryRaw<Array<{ timeZone: string }>>`
        SELECT current_setting('TimeZone') AS "timeZone"
      `;
      assert.deepEqual(timeZone, [{ timeZone: "UTC" }]);

      const lockedUsers = await transaction.$queryRaw<
        Array<{ id: string; authSessionRevision: number }>
      >`
        SELECT "id", "authSessionRevision"
        FROM public."User"
        WHERE "id" = ${user.id}
        FOR UPDATE
      `;
      assert.equal(lockedUsers.length, 1);
      const lockedUser = lockedUsers[0];
      assert.ok(lockedUser);
      assert.equal(lockedUser.id, user.id);

      const lockedPolicies = await transaction.$queryRaw<
        Array<{ id: number; revision: number; policyCount: number | bigint }>
      >`
        WITH "policyStatistics" AS MATERIALIZED (
          SELECT count(*) AS "policyCount"
          FROM public."AuthPolicyState"
        )
        SELECT policy."id", policy."revision", statistics."policyCount"
        FROM public."AuthPolicyState" AS policy
        CROSS JOIN "policyStatistics" AS statistics
        WHERE policy."id" = 1
        FOR SHARE OF policy
      `;
      assert.equal(lockedPolicies.length, 1);
      const lockedPolicy = lockedPolicies[0];
      assert.ok(lockedPolicy);
      assert.equal(lockedPolicy.id, 1);
      assert.ok(
        lockedPolicy.policyCount === 1 || lockedPolicy.policyCount === BigInt(1),
      );

      const clocks = await transaction.$queryRaw<Array<{ issuedAt: Date }>>`
        SELECT date_trunc('second', clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3)
          AS "issuedAt"
      `;
      const issuedAt = clocks[0]?.issuedAt;
      assert.ok(issuedAt instanceof Date);
      assert.equal(issuedAt.getMilliseconds(), 0);
      const expires = new Date(issuedAt.getTime() + 60 * 60 * 1_000);
      const claims = createAuthSessionClaimsV2({
        sub: user.id,
        sid: generateAuthSessionSid(),
        ur: lockedUser.authSessionRevision,
        pr: lockedPolicy.revision,
        issuedAt,
        absoluteExpiresAt: expires,
      });

      const transactionAuthoritative = createAuthoritativeSessionDatabase(
        transaction,
        SESSION_SECRET,
      );
      await transactionAuthoritative.insertLockedSession(
        transaction as Prisma.TransactionClient,
        {
          sid: claims.sid,
          userId: user.id,
          authSessionRevision: claims.ur,
          authPolicyRevision: claims.pr,
          issuedAt,
          expires,
        },
      );
      const token = await encodeAuthSessionJwt({
        secret: SESSION_SECRET,
        maxAge: claims.sae - claims.sat,
        token: { ...claims } as unknown as JWT,
      });
      const transactionGuard = createAuthoritativeSessionGuard({
        secret: SESSION_SECRET,
        activeCookieName: AUTH_SESSION_COOKIE_BASE_NAMES[0],
        decode: decodeAuthSessionJwt,
        validate: transactionAuthoritative.validate,
      });
      const firstResolution = await transactionGuard.resolve([
        { name: AUTH_SESSION_COOKIE_BASE_NAMES[0], value: token },
      ]);
      assert.equal(firstResolution.status, "authenticated");
      if (firstResolution.status === "authenticated") {
        assert.deepEqual(firstResolution.principal, {
          id: user.id,
          email,
          firstName: "Before",
          lastName: "Guard",
          name: "Before Guard",
          role: "CUSTOMER",
          requiresEmailVerification: false,
        });
      }

      const profileUpdate = await transaction.user.update({
        where: { id: user.id },
        data: { firstName: "After" },
        select: { authSessionRevision: true },
      });
      assert.equal(
        profileUpdate.authSessionRevision,
        lockedUser.authSessionRevision,
        "legitimate profile mutation must not require a session revision bump",
      );

      const refreshed = await transactionGuard.resolve([
        { name: AUTH_SESSION_COOKIE_BASE_NAMES[0], value: token },
      ]);
      assert.equal(refreshed.status, "authenticated");
      if (refreshed.status === "authenticated") {
        assert.equal(refreshed.principal.firstName, "After");
        assert.equal(refreshed.principal.name, "After Guard");
      }

      assert.equal(await transactionAuthoritative.revokeCurrent(claims), "revoked");
      assert.deepEqual(
        await transactionGuard.resolve([
          { name: AUTH_SESSION_COOKIE_BASE_NAMES[0], value: token },
        ]),
        { status: "anonymous", reason: "invalid" },
      );
    });
  },
);
