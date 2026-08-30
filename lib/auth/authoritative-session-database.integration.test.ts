import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { createAuthoritativeSessionDatabase } from "./authoritative-session-database";
import {
  createAuthSessionStorageKey,
  createAuthSessionClaimsV2,
  generateAuthSessionSid,
} from "./session-claims";

const RUN_DATABASE_TESTS = process.env.RUN_AUTH_SESSION_DB_TESTS === "true";
const SESSION_SECRET = "s".repeat(32);

function assertSafeTestDatabase(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL je obavezan za authoritative session integration test.",
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
  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error("Integration test zahteva PostgreSQL DATABASE_URL.");
  }
  if (
    !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(
      parsedUrl.hostname.toLowerCase(),
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

test(
  "authoritative session DB: validacija, revizija i current revoke su DB-authoritative",
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

    const databaseIdentity = await prisma.$queryRaw<
      Array<{ databaseName: string }>
    >`
      SELECT current_database() AS "databaseName"
    `;
    assert.deepEqual(databaseIdentity, [{ databaseName: expectedDatabaseName }]);

    const user = await prisma.user.create({
      data: {
        email: `auth-session-${runId}@example.invalid`,
        passwordHash: "integration-fixture-not-used",
        firstName: "Authoritative",
        lastName: "Session",
        role: "CUSTOMER",
      },
      select: { id: true, authSessionRevision: true },
    });
    userId = user.id;

    const policyRows = await prisma.$queryRaw<
      Array<{ revision: number }>
    >`
      SELECT "revision"
      FROM public."AuthPolicyState"
      WHERE "id" = 1
    `;
    assert.equal(policyRows.length, 1);
    const policyState = policyRows[0];
    const policyRevision = policyState?.revision;
    assert.ok(Number.isSafeInteger(policyRevision));

    const issuedAt = new Date(Math.floor(Date.now() / 1_000) * 1_000);
    const absoluteExpiresAt = new Date(issuedAt.getTime() + 60 * 60 * 1_000);
    const claims = createAuthSessionClaimsV2({
      sub: user.id,
      sid: generateAuthSessionSid(),
      ur: user.authSessionRevision,
      pr: policyRevision as number,
      issuedAt,
      absoluteExpiresAt,
    });
    const authoritative = createAuthoritativeSessionDatabase(
      prisma,
      SESSION_SECRET,
    );

    await prisma.$transaction(async (transaction) => {
      const lockedUser = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM public."User"
        WHERE "id" = ${user.id}
        FOR UPDATE
      `;
      assert.deepEqual(lockedUser, [{ id: user.id }]);
      const lockedPolicy = await transaction.$queryRaw<Array<{ id: number }>>`
        SELECT "id"
        FROM public."AuthPolicyState"
        WHERE "id" = 1
        FOR UPDATE
      `;
      assert.deepEqual(lockedPolicy, [{ id: 1 }]);
      await authoritative.insertLockedSession(
        transaction as Prisma.TransactionClient,
        {
          sid: claims.sid,
          userId: user.id,
          authSessionRevision: user.authSessionRevision,
          authPolicyRevision: policyRevision as number,
          issuedAt,
          expires: absoluteExpiresAt,
        },
      );
    });

    const storageKey = createAuthSessionStorageKey(
      SESSION_SECRET,
      claims.sid,
    );
    assert.ok(storageKey);
    const storedSession = await prisma.session.findUnique({
      where: {
        sessionToken: storageKey,
      },
      select: {
        sessionToken: true,
        userId: true,
        authSessionRevision: true,
        authPolicyRevision: true,
        issuedAt: true,
        expires: true,
      },
    });
    assert.ok(storedSession);
    assert.match(storedSession.sessionToken, /^v1:[0-9a-f]{64}$/);
    assert.notEqual(storedSession.sessionToken, claims.sid);
    assert.equal(storedSession.userId, user.id);
    assert.equal(storedSession.authSessionRevision, claims.ur);
    assert.equal(storedSession.authPolicyRevision, claims.pr);
    assert.equal(storedSession.issuedAt?.getTime(), issuedAt.getTime());
    assert.equal(
      storedSession.expires.getTime(),
      absoluteExpiresAt.getTime(),
    );

    const valid = await authoritative.validate(claims);
    assert.equal(valid.status, "valid");
    if (valid.status === "valid") {
      assert.equal(valid.principal.id, user.id);
      assert.equal("sid" in valid.principal, false);
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SET LOCAL TIME ZONE 'Europe/Belgrade'
      `;
      const timezone = await transaction.$queryRaw<Array<{ timeZone: string }>>`
        SELECT current_setting('TimeZone') AS "timeZone"
      `;
      assert.deepEqual(timezone, [{ timeZone: "Europe/Belgrade" }]);

      const transactionAuthoritative = createAuthoritativeSessionDatabase(
        transaction,
        SESSION_SECRET,
      );
      const transactionValid = await transactionAuthoritative.validate(claims);
      assert.equal(
        transactionValid.status,
        "valid",
        "UTC-normalizovan DB sat mora biti stabilan unutar druge TimeZone",
      );
    });

    const revisionBump = await prisma.user.updateMany({
      where: { id: user.id, authSessionRevision: user.authSessionRevision },
      data: { authSessionRevision: { increment: 1 } },
    });
    assert.equal(revisionBump.count, 1);
    assert.deepEqual(await authoritative.validate(claims), { status: "invalid" });

    // Revert the user revision only to test exact current-session revoke. This
    // leaves the fixture in its original state before cascade cleanup.
    await prisma.user.update({
      where: { id: user.id },
      data: { authSessionRevision: user.authSessionRevision },
    });

    await prisma.authPolicyState.update({
      where: { id: 1 },
      data: { revision: { increment: 1 } },
    });
    try {
      assert.deepEqual(await authoritative.validate(claims), {
        status: "invalid",
      });
    } finally {
      await prisma.authPolicyState.update({
        where: { id: 1 },
        data: { revision: policyRevision as number },
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: "OPERATOR" },
    });
    const freshRole = await authoritative.validate(claims);
    assert.equal(freshRole.status, "valid");
    if (freshRole.status === "valid") {
      assert.equal(freshRole.principal.role, "OPERATOR");
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { role: "CUSTOMER" },
    });

    assert.equal(await authoritative.revokeCurrent(claims), "revoked");
    assert.deepEqual(await authoritative.validate(claims), { status: "invalid" });
  },
);
