import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { createAuthoritativeSessionDatabase } from "./authoritative-session-database";
import {
  createCredentialsSessionIssuer,
  createPrismaCredentialsSessionIssuer,
  type CredentialsSessionIssuanceTransaction,
} from "./credentials-session-issuance";
import { CREDENTIALS_DUMMY_PASSWORD_HASH, hashPassword } from "./password";
import { createAuthSessionStorageKey, generateAuthSessionSid } from "./session-claims";

const RUN_DATABASE_TESTS =
  process.env.RUN_VERIFIED_LOGIN_DB_TESTS === "true";
const SESSION_SECRET = "credentials-v2-session-secret-at-least-32-bytes";

function assertSafeTestDatabase(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL je obavezan za credentials V2 issuer test.");
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
  "credentials V2 issuer atomically writes one HMAC Session and rolls it back when insert fails",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    const expectedDatabaseName = assertSafeTestDatabase();
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    const runId = randomUUID();
    const userIds: string[] = [];

    testContext.after(async () => {
      try {
        if (userIds.length > 0) {
          await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
      } finally {
        await prisma.$disconnect();
      }
    });

    const identity = await prisma.$queryRaw<Array<{ databaseName: string }>>`
      SELECT current_database() AS "databaseName"
    `;
    assert.deepEqual(identity, [{ databaseName: expectedDatabaseName }]);

    async function createVerifiedUser(purpose: string) {
      const user = await prisma.user.create({
        data: {
          email: `credentials-v2-${purpose}-${runId}@example.invalid`,
          passwordHash: CREDENTIALS_DUMMY_PASSWORD_HASH,
          firstName: "Credentials",
          lastName: "Issuer",
          role: "CUSTOMER",
        },
        select: { id: true, email: true, passwordHash: true },
      });
      userIds.push(user.id);
      await prisma.$executeRaw`
        UPDATE public."User"
        SET "emailVerified" = (clock_timestamp() AT TIME ZONE 'UTC')::timestamp(3)
        WHERE "id" = ${user.id}
      `;
      return user;
    }

    const authoritative = createAuthoritativeSessionDatabase(
      prisma,
      SESSION_SECRET,
    );
    const successUser = await createVerifiedUser("success");
    const issuer = createPrismaCredentialsSessionIssuer(prisma, SESSION_SECRET);
    const issued = await issuer.issue(
      {
        id: successUser.id,
        email: successUser.email,
        comparedPasswordHash: successUser.passwordHash,
      },
      generateAuthSessionSid(),
    );

    assert.ok(issued);
    assert.equal(issued.principal.id, successUser.id);
    assert.equal(issued.principal.email, successUser.email);
    assert.equal(issued.principal.requiresEmailVerification, false);
    assert.equal(issued.claims.sub, successUser.id);
    assert.equal(issued.claims.sae - issued.claims.sat, 86_400);

    const rows = await prisma.session.findMany({
      where: { userId: successUser.id },
      select: {
        sessionToken: true,
        userId: true,
        authSessionRevision: true,
        authPolicyRevision: true,
        issuedAt: true,
        expires: true,
      },
    });
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.ok(row);
    assert.match(row.sessionToken, /^v1:[0-9a-f]{64}$/);
    assert.notEqual(row.sessionToken, issued.claims.sid);
    assert.equal(
      row.sessionToken,
      createAuthSessionStorageKey(SESSION_SECRET, issued.claims.sid),
    );
    assert.equal(row.userId, issued.claims.sub);
    assert.equal(row.authSessionRevision, issued.claims.ur);
    assert.equal(row.authPolicyRevision, issued.claims.pr);
    assert.equal(row.issuedAt?.getTime(), issued.claims.sat * 1_000);
    assert.equal(row.expires.getTime(), issued.claims.sae * 1_000);

    const validation = await authoritative.validate(issued.claims);
    assert.equal(validation.status, "valid");
    if (validation.status === "valid") {
      assert.deepEqual(validation.principal, issued.principal);
    }

    const staleUser = await createVerifiedUser("stale-bcrypt");
    const staleCandidate = {
      id: staleUser.id,
      email: staleUser.email,
      comparedPasswordHash: staleUser.passwordHash,
    };
    const replacementHash = await hashPassword("PromenjenaIssuerLozinka1!");
    await prisma.user.update({
      where: { id: staleUser.id },
      data: { passwordHash: replacementHash },
    });
    assert.equal(await issuer.issue(staleCandidate, generateAuthSessionSid()), null);
    assert.equal(
      await prisma.session.count({ where: { userId: staleUser.id } }),
      0,
      "stale bcrypt snapshot must not create a V2 Session",
    );

    const belgradeUser = await createVerifiedUser("belgrade-clock");
    const belgradeIssuer = createCredentialsSessionIssuer({
      database: {
        transaction: (work) =>
          prisma.$transaction(async (transaction) => {
            await transaction.$executeRaw`
              SET LOCAL TIME ZONE 'Europe/Belgrade'
            `;
            return work(
              transaction as unknown as CredentialsSessionIssuanceTransaction,
            );
          }),
      },
      insertLockedSession: (transaction, input) =>
        authoritative.insertLockedSession(
          transaction as unknown as Prisma.TransactionClient,
          input,
        ),
    });
    const belgradeIssued = await belgradeIssuer.issue(
      {
        id: belgradeUser.id,
        email: belgradeUser.email,
        comparedPasswordHash: belgradeUser.passwordHash,
      },
      generateAuthSessionSid(),
    );
    assert.ok(belgradeIssued);
    assert.equal(
      new Date(belgradeIssued.claims.sat * 1_000).getMilliseconds(),
      0,
      "UTC claims clock must be second-aligned under a non-UTC DB session",
    );
    assert.equal(belgradeIssued.claims.sae - belgradeIssued.claims.sat, 86_400);
    const belgradeRows = await prisma.session.findMany({
      where: { userId: belgradeUser.id },
      select: { sessionToken: true },
    });
    assert.equal(belgradeRows.length, 1);
    assert.match(belgradeRows[0]?.sessionToken ?? "", /^v1:[0-9a-f]{64}$/);
    assert.equal(
      (await authoritative.validate(belgradeIssued.claims)).status,
      "valid",
    );

    const rollbackUser = await createVerifiedUser("rollback");
    const failingIssuer = createPrismaCredentialsSessionIssuer(
      prisma,
      SESSION_SECRET,
      {
        async insertLockedSession(transaction, input) {
          await authoritative.insertLockedSession(
            transaction as unknown as Prisma.TransactionClient,
            input,
          );
          throw new Error("Injected Session insert failure after write");
        },
      },
    );
    assert.equal(
      await failingIssuer.issue(
        {
          id: rollbackUser.id,
          email: rollbackUser.email,
          comparedPasswordHash: rollbackUser.passwordHash,
        },
        generateAuthSessionSid(),
      ),
      null,
    );
    assert.equal(
      await prisma.session.count({ where: { userId: rollbackUser.id } }),
      0,
      "transaction rollback must remove the attempted V2 Session insert",
    );
  },
);
