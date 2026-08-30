import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";

const RUN_DATABASE_TESTS =
  process.env.RUN_AUTH_VERIFICATION_DB_TESTS === "true";
const SECRET = "integration-session-rotation-secret-32-bytes-minimum";

function assertSafeTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() !== databaseUrl) {
    throw new Error("DATABASE_URL je obavezan i mora biti bez okolnih razmaka.");
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nije validna URL adresa.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("Integration test zahteva PostgreSQL DATABASE_URL.");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(hostname)) {
    throw new Error("Integration test je ograničen na lokalni PostgreSQL.");
  }
  let databaseName: string;
  try {
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("Naziv baze u DATABASE_URL nije validno kodiran.");
  }
  const normalizedName = databaseName.toLowerCase();
  if (!databaseName || databaseName.includes("/")) {
    throw new Error("Integration test zahteva jedan neprazan naziv baze.");
  }
  if (/(?:^|[_-])(?:prod|production|live)(?:$|[_-])/.test(normalizedName)) {
    throw new Error("Integration test eksplicitno odbija prod/live bazu.");
  }
  if (!/(?:^|[_-])(?:e2e|test|provera)(?:$|[_-])/.test(normalizedName)) {
    throw new Error("Integration test zahteva jasno označenu test bazu.");
  }
}

function wholeSecondNow(): Date {
  return new Date(Math.floor(Date.now() / 1_000) * 1_000);
}

test(
  "verified rotation revokes legacy/V2 rows and commits one HMAC-only V2 session",
  { skip: !RUN_DATABASE_TESTS, timeout: 20_000 },
  async (context) => {
    assertSafeTestDatabase();
    const { prisma } = await import("@/lib/db");
    const {
      createStoredEmailVerificationClaim,
    } = await import("./email-verification");
    const {
      commitEmailVerificationSessionRotation,
    } = await import("./email-verification-session-rotation");
    const {
      createAuthoritativeSessionDatabase,
    } = await import("./authoritative-session-database");
    const {
      createAuthSessionStorageKey,
      generateAuthSessionSid,
    } = await import("./session-claims");
    const { hashCredentialToken } = await import("./credential-token");

    const runId = randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `rotation-${runId}@example.invalid`,
        passwordHash: "integration-password-not-used",
        firstName: "Rotation",
        lastName: "Success",
      },
      select: { id: true, authSessionRevision: true },
    });
    context.after(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: user.id } });
      } finally {
        await prisma.$disconnect();
      }
    });

    const policy = await prisma.authPolicyState.findUniqueOrThrow({
      where: { id: 1 },
      select: { revision: true },
    });
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashCredentialToken("email-verification", rawToken);
    assert.ok(tokenHash);
    const verification = await prisma.emailVerification.create({
      data: {
        userId: user.id,
        token: rawToken,
        tokenHash,
        expires: new Date(Date.now() + 120_000),
      },
      include: { user: true },
    });
    const oldIssuedAt = wholeSecondNow();
    const oldV2Sid = generateAuthSessionSid();
    const oldV2Digest = createAuthSessionStorageKey(SECRET, oldV2Sid);
    assert.ok(oldV2Digest);
    await prisma.session.createMany({
      data: [
        {
          sessionToken: `legacy-rotation-${runId}`,
          userId: user.id,
          expires: new Date(oldIssuedAt.getTime() + 3_600_000),
        },
        {
          sessionToken: oldV2Digest,
          userId: user.id,
          authSessionRevision: user.authSessionRevision,
          authPolicyRevision: policy.revision,
          issuedAt: oldIssuedAt,
          expires: new Date(oldIssuedAt.getTime() + 3_600_000),
        },
      ],
    });

    const claim = createStoredEmailVerificationClaim(verification);
    assert.ok(claim);
    const sid = generateAuthSessionSid();
    const belgradeTransactionDatabase = {
      $transaction: async <T>(
        work: (transaction: Prisma.TransactionClient) => Promise<T>,
      ): Promise<T> =>
        prisma.$transaction(async (transaction) => {
          await transaction.$executeRaw`
            SET LOCAL TIME ZONE 'Europe/Belgrade'
          `;
          const timezone = await transaction.$queryRaw<Array<{ timeZone: string }>>`
            SELECT current_setting('TimeZone') AS "timeZone"
          `;
          assert.deepEqual(timezone, [{ timeZone: "Europe/Belgrade" }]);
          return work(transaction);
        }),
    } as Pick<PrismaClient, "$transaction">;
    const prepared = await commitEmailVerificationSessionRotation(
      belgradeTransactionDatabase,
      claim,
      {
        secret: SECRET,
        sid,
        prepareSuccessResult({ claims, user: lockedUser }) {
          return { claims, user: lockedUser };
        },
      },
    );

    assert.equal(prepared.claims.sid, sid);
    assert.equal(prepared.claims.ur, user.authSessionRevision + 1);
    assert.equal(prepared.claims.pr, policy.revision);
    const [storedUser, storedSessions, remainingCredentials] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { emailVerified: true, authSessionRevision: true },
      }),
      prisma.session.findMany({
        where: { userId: user.id },
        select: {
          sessionToken: true,
          authSessionRevision: true,
          authPolicyRevision: true,
          issuedAt: true,
          expires: true,
        },
      }),
      prisma.emailVerification.findMany({ where: { userId: user.id } }),
    ]);
    assert.ok(storedUser.emailVerified instanceof Date);
    assert.ok(
      storedUser.emailVerified.getTime() >= prepared.claims.sat * 1_000 &&
        storedUser.emailVerified.getTime() <
          prepared.claims.sat * 1_000 + 1_000,
      "emailVerified mora ostati u tačnom DB sekundu iz kog su izvedene claims",
    );
    assert.equal(storedUser.authSessionRevision, user.authSessionRevision + 1);
    assert.equal(storedSessions.length, 1);
    const storedSession = storedSessions[0];
    assert.ok(storedSession);
    const newDigest = createAuthSessionStorageKey(SECRET, sid);
    assert.equal(storedSession.sessionToken, newDigest);
    assert.notEqual(storedSession.sessionToken, sid);
    assert.match(storedSession.sessionToken, /^v1:[0-9a-f]{64}$/);
    assert.equal(storedSession.authSessionRevision, prepared.claims.ur);
    assert.equal(storedSession.authPolicyRevision, prepared.claims.pr);
    assert.equal(storedSession.issuedAt?.getTime(), prepared.claims.sat * 1_000);
    assert.equal(storedSession.expires.getTime(), prepared.claims.sae * 1_000);
    assert.deepEqual(remainingCredentials, []);

    const authority = createAuthoritativeSessionDatabase(prisma, SECRET);
    assert.equal((await authority.validate(prepared.claims)).status, "valid");
  },
);

test(
  "injected Session insert and credential cleanup failures roll every verification mutation back",
  { skip: !RUN_DATABASE_TESTS, timeout: 20_000 },
  async (context) => {
    assertSafeTestDatabase();
    const { prisma } = await import("@/lib/db");
    const { createStoredEmailVerificationClaim } = await import("./email-verification");
    const {
      EmailVerificationSessionRotationUnavailableError,
      commitEmailVerificationSessionRotation,
    } = await import("./email-verification-session-rotation");
    const { hashCredentialToken } = await import("./credential-token");

    const userIds: string[] = [];
    context.after(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      } finally {
        await prisma.$disconnect();
      }
    });

    for (const failure of ["insert", "cleanup"] as const) {
      const runId = randomUUID();
      const graceUntil = new Date("2030-01-02T03:04:05.000Z");
      const nextAllowedAt = new Date("2030-01-02T03:05:05.000Z");
      const resendWindowStartedAt = new Date("2030-01-02T03:00:05.000Z");
      const user = await prisma.user.create({
        data: {
          email: `rotation-rollback-${failure}-${runId}@example.invalid`,
          passwordHash: "integration-password-not-used",
          firstName: "Rotation",
          lastName: "Rollback",
          emailVerificationLoginGraceUntil: graceUntil,
          verificationEmailNextAllowedAt: nextAllowedAt,
          verificationEmailResendWindowStartedAt: resendWindowStartedAt,
          verificationEmailResendCount: 3,
        },
        select: { id: true, authSessionRevision: true },
      });
      userIds.push(user.id);
      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = hashCredentialToken("email-verification", rawToken);
      assert.ok(tokenHash);
      const verification = await prisma.emailVerification.create({
        data: {
          userId: user.id,
          token: rawToken,
          tokenHash,
          expires: new Date(Date.now() + 120_000),
        },
        include: { user: true },
      });
      await prisma.session.create({
        data: {
          sessionToken: `legacy-rollback-${failure}-${runId}`,
          userId: user.id,
          expires: new Date(Date.now() + 3_600_000),
        },
      });
      const claim = createStoredEmailVerificationClaim(verification);
      assert.ok(claim);

      const faultInjectingDatabase = {
        $transaction: async <T>(
          work: (transaction: Prisma.TransactionClient) => Promise<T>,
        ): Promise<T> =>
          prisma.$transaction(async (transaction) => {
            const faultyTransaction = new Proxy(transaction, {
              get(target, property, receiver) {
                if (property === "session" && failure === "insert") {
                  return new Proxy(target.session, {
                    get(sessionTarget, sessionProperty, sessionReceiver) {
                      if (sessionProperty === "create") {
                        return async (...args: unknown[]) => {
                          await Reflect.apply(
                            sessionTarget.create,
                            sessionTarget,
                            args,
                          );
                          throw new Error("injected session insert failure");
                        };
                      }
                      return Reflect.get(sessionTarget, sessionProperty, sessionReceiver);
                    },
                  });
                }
                if (property === "emailVerification" && failure === "cleanup") {
                  return new Proxy(target.emailVerification, {
                    get(credentialTarget, credentialProperty, credentialReceiver) {
                      if (credentialProperty === "deleteMany") {
                        return async (...args: unknown[]) => {
                          const result = await Reflect.apply(
                            credentialTarget.deleteMany,
                            credentialTarget,
                            args,
                          );
                          const where = (args[0] as { where?: Record<string, unknown> } | undefined)?.where;
                          if (where && "id" in where) {
                            throw new Error("injected credential cleanup failure");
                          }
                          return result;
                        };
                      }
                      return Reflect.get(credentialTarget, credentialProperty, credentialReceiver);
                    },
                  });
                }
                return Reflect.get(target, property, receiver);
              },
            });
            return work(faultyTransaction as Prisma.TransactionClient);
          }),
      } as Pick<PrismaClient, "$transaction">;

      await assert.rejects(
        commitEmailVerificationSessionRotation(faultInjectingDatabase, claim, {
          secret: SECRET,
          prepareSuccessResult: () => ({ prepared: true }),
        }),
        EmailVerificationSessionRotationUnavailableError,
      );
      const [afterUser, afterSessions, afterCredentials] = await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: {
            emailVerified: true,
            authSessionRevision: true,
            emailVerificationLoginGraceUntil: true,
            verificationEmailNextAllowedAt: true,
            verificationEmailResendWindowStartedAt: true,
            verificationEmailResendCount: true,
          },
        }),
        prisma.session.findMany({ where: { userId: user.id } }),
        prisma.emailVerification.findMany({ where: { userId: user.id } }),
      ]);
      assert.equal(afterUser.emailVerified, null);
      assert.equal(afterUser.authSessionRevision, user.authSessionRevision);
      assert.equal(
        afterUser.emailVerificationLoginGraceUntil?.getTime(),
        graceUntil.getTime(),
      );
      assert.equal(
        afterUser.verificationEmailNextAllowedAt?.getTime(),
        nextAllowedAt.getTime(),
      );
      assert.equal(
        afterUser.verificationEmailResendWindowStartedAt?.getTime(),
        resendWindowStartedAt.getTime(),
      );
      assert.equal(afterUser.verificationEmailResendCount, 3);
      assert.equal(afterSessions.length, 1);
      assert.equal(afterCredentials.length, 1);
      assert.equal(afterCredentials[0]?.id, verification.id);
    }
  },
);
