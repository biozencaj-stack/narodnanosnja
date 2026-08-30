import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { hashCredentialToken } from "./credential-token";
import { normalizeEmailAddress } from "./email-address";
import { hashPassword, verifyPassword } from "./password";
import {
  REGISTRATION_VERIFICATION_COOLDOWN_MS,
  REGISTRATION_VERIFICATION_INITIAL_EMAIL_COUNT,
  REGISTRATION_VERIFICATION_TOKEN_LIFETIME_MS,
  isUniqueConstraintFailure,
  registerAccount,
  type RegistrationDatabase,
  type RegistrationInput,
} from "./registration";

const RUN_DATABASE_TESTS =
  process.env.RUN_REGISTRATION_DB_TESTS === "true";

function assertSafeTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL je obavezan za integration test registracije.",
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

function databaseAdapter(
  prisma: PrismaClient,
  options: {
    failVerificationInsert?: boolean;
    beforeCreateUser?: () => Promise<void>;
  } = {},
): RegistrationDatabase {
  return {
    transaction: (work) =>
      prisma.$transaction((transaction) =>
        work({
          createUser: async (user) => {
            await options.beforeCreateUser?.();
            return transaction.user.create({
              data: {
                email: user.email,
                passwordHash: user.passwordHash,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: "CUSTOMER",
                emailVerificationLoginGraceUntil:
                  user.emailVerificationLoginGraceUntil,
                verificationEmailNextAllowedAt:
                  user.verificationEmailNextAllowedAt,
                verificationEmailResendWindowStartedAt:
                  user.verificationEmailResendWindowStartedAt,
                verificationEmailResendCount:
                  user.verificationEmailResendCount,
              },
              select: { id: true },
            });
          },
          createEmailVerification: async (verification) => {
            if (options.failVerificationInsert) {
              throw new Error("Injected verification insert failure");
            }
            await transaction.emailVerification.create({
              data: {
                userId: verification.userId,
                token: verification.legacyPlaintextToken,
                tokenHash: verification.tokenHash,
                expires: verification.expires,
              },
            });
          },
        }),
      ),
    findUserByEmail: (normalizedEmail) =>
      prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      }),
  };
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

function createInput(
  normalizedEmail: string,
  values: {
    passwordHash: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    rawToken: string;
    issuedAt: Date;
  },
): RegistrationInput {
  const tokenHash = hashCredentialToken(
    "email-verification",
    values.rawToken,
  );
  if (!tokenHash) throw new Error("Test token must produce a hash");

  return {
    normalizedEmail,
    passwordHash: values.passwordHash,
    firstName: values.firstName,
    lastName: values.lastName,
    phone: values.phone,
    legacyPlaintextToken: values.rawToken,
    tokenHash,
    issuedAt: values.issuedAt,
  };
}

test(
  "atomska registracija: konkurentni email, rollback i tokenHash kolizija",
  { skip: !RUN_DATABASE_TESTS, timeout: 20_000 },
  async (testContext) => {
    assertSafeTestDatabase();

    const { PrismaClient } = await import("@prisma/client");
    // Separate clients guarantee separate PostgreSQL workers/connections for
    // the concurrent unique-email race rather than serializing in one callback.
    const firstWorker = new PrismaClient();
    const secondWorker = new PrismaClient();
    const runId = randomUUID();
    const concurrentEmail = normalizeEmailAddress(
      `  REGISTRATION-CONCURRENT-${runId}@EXAMPLE.INVALID  `,
    );
    assert.ok(concurrentEmail);
    const rollbackEmail = `registration-rollback-${runId}@example.invalid`;
    const collisionEmail = `registration-collision-${runId}@example.invalid`;
    const fixtureEmail = `registration-token-fixture-${runId}@example.invalid`;
    const cleanupEmails = [
      concurrentEmail,
      rollbackEmail,
      collisionEmail,
      fixtureEmail,
    ];

    testContext.after(async () => {
      try {
        await firstWorker.user.deleteMany({
          where: { email: { in: cleanupEmails } },
        });
      } finally {
        await Promise.allSettled([
          firstWorker.$disconnect(),
          secondWorker.$disconnect(),
        ]);
      }
    });

    const candidatePasswords = ["KonkurentnaPrva1!", "KonkurentnaDruga2!"];
    const candidateHashes = await Promise.all(
      candidatePasswords.map((password) => hashPassword(password)),
    );
    const candidateIssuedAt = [
      new Date("2026-08-30T16:00:00.000Z"),
      new Date("2026-08-30T16:00:01.000Z"),
    ];
    const concurrentInputs = candidateHashes.map((passwordHash, index) =>
      createInput(concurrentEmail, {
        passwordHash,
        firstName: index === 0 ? "Prvi" : "Drugi",
        lastName: index === 0 ? "Radnik" : "Pokušaj",
        phone: index === 0 ? "+381 60 111 111" : "+381 60 222 222",
        rawToken: randomBytes(32).toString("hex"),
        issuedAt: candidateIssuedAt[index],
      }),
    );

    const waitForBothWorkers = createTwoWorkerBarrier();
    const concurrentResults = await Promise.all([
      registerAccount(
        concurrentInputs[0],
        databaseAdapter(firstWorker, {
          beforeCreateUser: waitForBothWorkers,
        }),
      ),
      registerAccount(
        concurrentInputs[1],
        databaseAdapter(secondWorker, {
          beforeCreateUser: waitForBothWorkers,
        }),
      ),
    ]);
    const createdIndexes = concurrentResults
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.kind === "created")
      .map(({ index }) => index);
    const existingResults = concurrentResults.filter(
      (result) => result.kind === "existing",
    );

    assert.equal(createdIndexes.length, 1);
    assert.equal(existingResults.length, 1);
    const winnerIndex = createdIndexes[0];
    const loserIndex = winnerIndex === 0 ? 1 : 0;
    const winner = concurrentInputs[winnerIndex];
    const persistedUsers = await firstWorker.user.findMany({
      where: { email: concurrentEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        firstName: true,
        lastName: true,
        phone: true,
        emailVerificationLoginGraceUntil: true,
        verificationEmailNextAllowedAt: true,
        verificationEmailResendWindowStartedAt: true,
        verificationEmailResendCount: true,
        emailVerifications: {
          select: {
            token: true,
            tokenHash: true,
            expires: true,
          },
        },
      },
    });

    assert.equal(persistedUsers.length, 1);
    const persisted = persistedUsers[0];
    assert.equal(persisted.email, concurrentEmail);
    assert.equal(persisted.passwordHash, winner.passwordHash);
    assert.equal(persisted.firstName, winner.firstName);
    assert.equal(persisted.lastName, winner.lastName);
    assert.equal(persisted.phone, winner.phone);
    assert.equal(persisted.emailVerificationLoginGraceUntil, null);
    assert.equal(
      persisted.verificationEmailNextAllowedAt?.getTime(),
      winner.issuedAt.getTime() + REGISTRATION_VERIFICATION_COOLDOWN_MS,
    );
    assert.equal(
      persisted.verificationEmailResendWindowStartedAt?.getTime(),
      winner.issuedAt.getTime(),
    );
    assert.equal(
      persisted.verificationEmailResendCount,
      REGISTRATION_VERIFICATION_INITIAL_EMAIL_COUNT,
    );
    assert.equal(
      await verifyPassword(
        candidatePasswords[winnerIndex],
        persisted.passwordHash,
      ),
      true,
    );
    assert.equal(
      await verifyPassword(
        candidatePasswords[loserIndex],
        persisted.passwordHash,
      ),
      false,
    );
    assert.deepEqual(persisted.emailVerifications, [
      {
        token: winner.legacyPlaintextToken,
        tokenHash: winner.tokenHash,
        expires: new Date(
          winner.issuedAt.getTime() +
            REGISTRATION_VERIFICATION_TOKEN_LIFETIME_MS,
        ),
      },
    ]);

    // An error in the second write must roll back the already-issued User row.
    const rollbackToken = randomBytes(32).toString("hex");
    const rollbackInput = createInput(rollbackEmail, {
      passwordHash: await hashPassword("RollbackLozinka3!"),
      firstName: "Rollback",
      lastName: "Registracija",
      phone: null,
      rawToken: rollbackToken,
      issuedAt: new Date(),
    });
    await assert.rejects(
      registerAccount(
        rollbackInput,
        databaseAdapter(firstWorker, { failVerificationInsert: true }),
      ),
      /Injected verification insert failure/,
    );
    assert.equal(
      await firstWorker.user.count({ where: { email: rollbackEmail } }),
      0,
    );
    assert.equal(
      await firstWorker.emailVerification.count({
        where: { tokenHash: rollbackInput.tokenHash },
      }),
      0,
    );

    // Keep plaintext null on the fixture so the actual unique violation can
    // only originate from tokenHash, not the compatibility token column.
    const collidingRawToken = randomBytes(32).toString("hex");
    const collidingTokenHash = hashCredentialToken(
      "email-verification",
      collidingRawToken,
    );
    assert.ok(collidingTokenHash);
    const fixtureUser = await firstWorker.user.create({
      data: {
        email: fixtureEmail,
        passwordHash: "registration-integration-fixture",
        firstName: "Token",
        lastName: "Fixture",
      },
      select: { id: true },
    });
    await firstWorker.emailVerification.create({
      data: {
        userId: fixtureUser.id,
        token: null,
        tokenHash: collidingTokenHash,
        expires: new Date(Date.now() + 60_000),
      },
    });
    const collisionInput = createInput(collisionEmail, {
      passwordHash: await hashPassword("KolizijaLozinka4!"),
      firstName: "Kolizija",
      lastName: "Kandidat",
      phone: null,
      rawToken: collidingRawToken,
      issuedAt: new Date(),
    });
    let collisionResult: Awaited<ReturnType<typeof registerAccount>> | null =
      null;
    let collisionError: unknown;
    try {
      collisionResult = await registerAccount(
        collisionInput,
        databaseAdapter(secondWorker),
      );
    } catch (error) {
      collisionError = error;
    }

    assert.equal(collisionResult, null);
    assert.equal(isUniqueConstraintFailure(collisionError), true);
    assert.equal(
      await firstWorker.user.count({ where: { email: collisionEmail } }),
      0,
    );
    assert.equal(
      await firstWorker.emailVerification.count({
        where: { tokenHash: collidingTokenHash },
      }),
      1,
    );
  },
);
