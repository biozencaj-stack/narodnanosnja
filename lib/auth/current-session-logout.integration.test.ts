import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import {
  AUTH_SESSION_COOKIE_BASE_NAMES,
  MAX_AUTH_SESSION_COOKIE_CLEANUPS,
} from "./auth-session-cookie-cleanup";
import { createAuthoritativeSessionDatabase } from "./authoritative-session-database";
import { createCurrentSessionLogoutPlan } from "./current-session-logout";
import {
  createAuthSessionClaimsV2,
  createAuthSessionStorageKey,
  generateAuthSessionSid,
} from "./session-claims";

const RUN_DATABASE_TESTS = process.env.RUN_AUTH_SESSION_DB_TESTS === "true";
const SESSION_SECRET = "current-session-logout-secret-at-least-32-bytes";

function assertSafeTestDatabase(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() !== databaseUrl) {
    throw new Error("DATABASE_URL je obavezan za logout integration test.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nije validna URL adresa.");
  }
  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error("Logout integration test zahteva PostgreSQL.");
  }
  if (
    !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(
      parsedUrl.hostname.toLowerCase(),
    )
  ) {
    throw new Error("Logout integration test zahteva loopback PostgreSQL.");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("Naziv logout test baze nije validan.");
  }
  if (
    !databaseName ||
    databaseName.includes("/") ||
    !/(?:^|[_-])(?:e2e|test|provera)(?:$|[_-])/i.test(databaseName) ||
    /(?:^|[_-])(?:prod|production|live)(?:$|[_-])/i.test(databaseName)
  ) {
    throw new Error("Logout integration test je odbijen van test baze.");
  }
  return databaseName;
}

test(
  "current logout revokes exactly one V2 session, preserves its sibling and clears replay",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    const expectedDatabaseName = assertSafeTestDatabase();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const runId = randomUUID();
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

    const user = await prisma.user.create({
      data: {
        email: `logout-${runId}@example.invalid`,
        passwordHash: "logout-integration-not-used",
        firstName: "Current",
        lastName: "Logout",
        role: "CUSTOMER",
      },
      select: { id: true },
    });
    userId = user.id;

    const issuedAt = new Date(Math.floor(Date.now() / 1_000) * 1_000);
    const expires = new Date(issuedAt.getTime() + 60 * 60 * 1_000);
    const sidA = generateAuthSessionSid();
    const sidB = generateAuthSessionSid();
    const authoritative = createAuthoritativeSessionDatabase(
      prisma,
      SESSION_SECRET,
    );

    const { claimsA, claimsB } = await prisma.$transaction(
      async (transaction) => {
        const lockedUsers = await transaction.$queryRaw<
          Array<{ id: string; authSessionRevision: number }>
        >`
          SELECT "id", "authSessionRevision"
          FROM public."User"
          WHERE "id" = ${user.id}
          FOR UPDATE
        `;
        const lockedUser = lockedUsers[0];
        assert.equal(lockedUsers.length, 1);
        assert.ok(lockedUser);
        assert.equal(lockedUser.id, user.id);
        const lockedPolicies = await transaction.$queryRaw<
          Array<{ id: number; revision: number }>
        >`
          SELECT "id", "revision"
          FROM public."AuthPolicyState"
          WHERE "id" = 1
          FOR SHARE
        `;
        const lockedPolicy = lockedPolicies[0];
        assert.equal(lockedPolicies.length, 1);
        assert.ok(lockedPolicy);
        assert.equal(lockedPolicy.id, 1);
        const claimsA = createAuthSessionClaimsV2({
          sub: user.id,
          sid: sidA,
          ur: lockedUser.authSessionRevision,
          pr: lockedPolicy.revision,
          issuedAt,
          absoluteExpiresAt: expires,
        });
        const claimsB = createAuthSessionClaimsV2({
          sub: user.id,
          sid: sidB,
          ur: lockedUser.authSessionRevision,
          pr: lockedPolicy.revision,
          issuedAt,
          absoluteExpiresAt: expires,
        });
        for (const claims of [claimsA, claimsB]) {
          await authoritative.insertLockedSession(
            transaction as Prisma.TransactionClient,
            {
              sid: claims.sid,
              userId: user.id,
              authSessionRevision: lockedUser.authSessionRevision,
              authPolicyRevision: lockedPolicy.revision,
              issuedAt,
              expires,
            },
          );
        }
        return { claimsA, claimsB };
      },
    );

    const revokeResults: string[] = [];
    const logoutDependencies = {
      revokeCurrent: async (claims: typeof claimsA) => {
        const result = await authoritative.revokeCurrent(claims);
        revokeResults.push(result);
        return result;
      },
    };
    const requestCookies = [
      { name: AUTH_SESSION_COOKIE_BASE_NAMES[0] },
      { name: `${AUTH_SESSION_COOKIE_BASE_NAMES[0]}.0` },
      { name: `${AUTH_SESSION_COOKIE_BASE_NAMES[0]}.1` },
    ];

    const firstPlan = await createCurrentSessionLogoutPlan(
      claimsA,
      requestCookies,
      logoutDependencies,
    );
    assert.equal(firstPlan.disposition, "clear");
    assert.ok(firstPlan.cleanup.cookies.length <= MAX_AUTH_SESSION_COOKIE_CLEANUPS);
    assert.equal(firstPlan.cleanup.hasRemainingRecognizedChunks, false);
    assert.deepEqual(
      firstPlan.cleanup.cookies.map((cookie) => cookie.name),
      [
        AUTH_SESSION_COOKIE_BASE_NAMES[0],
        `${AUTH_SESSION_COOKIE_BASE_NAMES[0]}.0`,
        `${AUTH_SESSION_COOKIE_BASE_NAMES[0]}.1`,
        ...AUTH_SESSION_COOKIE_BASE_NAMES.slice(1),
      ],
    );
    assert.deepEqual(revokeResults, ["revoked"]);

    assert.deepEqual(await authoritative.validate(claimsA), { status: "invalid" });
    const siblingStorageKey = createAuthSessionStorageKey(
      SESSION_SECRET,
      claimsB.sid,
    );
    assert.ok(siblingStorageKey);
    assert.deepEqual(
      await prisma.session.findMany({
        where: { userId: user.id },
        select: { sessionToken: true },
      }),
      [{ sessionToken: siblingStorageKey }],
      "logout A must preserve exactly the independently addressed sibling B",
    );

    const replayPlan = await createCurrentSessionLogoutPlan(
      claimsA,
      requestCookies,
      logoutDependencies,
    );
    assert.equal(replayPlan.disposition, "clear");
    assert.ok(replayPlan.cleanup.cookies.length <= MAX_AUTH_SESSION_COOKIE_CLEANUPS);
    assert.deepEqual(revokeResults, ["revoked", "invalid"]);
    assert.deepEqual(
      await prisma.session.findMany({
        where: { userId: user.id },
        select: { sessionToken: true },
      }),
      [{ sessionToken: siblingStorageKey }],
    );
  },
);
