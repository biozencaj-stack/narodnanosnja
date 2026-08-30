import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { hashCredentialToken } from "./credential-token";
import {
  hashPassword,
  verifyPassword,
  verifyPasswordConstantWork,
} from "./password";
import {
  changeAuthenticatedPassword,
  createPrismaPasswordChangeDatabase,
  type PasswordChangeCrypto,
} from "./password-change";

const RUN_DATABASE_TESTS =
  process.env.RUN_PASSWORD_CHANGE_DB_TESTS === "true" ||
  process.env.RUN_PASSWORD_RESET_CONFIRM_DB_TESTS === "true";

function assertSafeTestDatabase(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() !== databaseUrl) {
    throw new Error("DATABASE_URL je obavezan za password-change DB test.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nije validna URL adresa.");
  }
  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error("Password-change test zahteva PostgreSQL.");
  }
  if (
    !["127.0.0.1", "localhost", "::1", "[::1]"].includes(
      parsedUrl.hostname.toLowerCase(),
    )
  ) {
    throw new Error("Password-change DB test zahteva lokalnu test bazu.");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(
      parsedUrl.pathname.replace(/^\/+/, ""),
    );
  } catch {
    throw new Error("Naziv password-change test baze nije validan.");
  }
  if (
    !databaseName ||
    databaseName.includes("/") ||
    !/(?:^|[_-])(?:e2e|test|provera)(?:$|[_-])/i.test(databaseName) ||
    /(?:^|[_-])(?:prod|production|live)(?:$|[_-])/i.test(databaseName)
  ) {
    throw new Error("Password-change test je odbijen van namenske test baze.");
  }
  return databaseName;
}

test(
  "password change atomski čisti tokene i odbija hash mutiran posle bcrypt-a",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    const expectedDatabaseName = assertSafeTestDatabase();
    const { prisma } = await import("@/lib/db");
    const runId = randomUUID();
    const userIds: string[] = [];

    testContext.after(async () => {
      try {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      } finally {
        await prisma.$disconnect();
      }
    });

    const identity = await prisma.$queryRaw<
      Array<{ databaseName: string }>
    >`SELECT current_database() AS "databaseName"`;
    assert.deepEqual(identity, [{ databaseName: expectedDatabaseName }]);

    const database = createPrismaPasswordChangeDatabase(prisma);
    const currentPassword = "TrenutnaIntegracija1!";
    const newPassword = "NovaIntegracija2!";
    const currentPasswordHash = await hashPassword(currentPassword);
    const expires = new Date(Date.now() + 60_000);

    async function createCredentialFixtures(purpose: string) {
      const user = await prisma.user.create({
        data: {
          email: `password-change-${purpose}-${runId}@example.invalid`,
          passwordHash: currentPasswordHash,
          firstName: "Password",
          lastName: "ChangeTest",
        },
        select: { id: true },
      });
      userIds.push(user.id);
      const resetToken = randomBytes(32).toString("hex");
      const resetTokenHash = hashCredentialToken(
        "password-reset",
        resetToken,
      );
      const verificationToken = randomBytes(32).toString("hex");
      const verificationTokenHash = hashCredentialToken(
        "email-verification",
        verificationToken,
      );
      assert.ok(resetTokenHash);
      assert.ok(verificationTokenHash);
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          token: resetToken,
          tokenHash: resetTokenHash,
          expires,
        },
      });
      await prisma.emailVerification.create({
        data: {
          userId: user.id,
          token: verificationToken,
          tokenHash: verificationTokenHash,
          expires,
        },
      });
      return user;
    }

    const successUser = await createCredentialFixtures("success");
    assert.deepEqual(
      await changeAuthenticatedPassword(
        {
          userId: successUser.id,
          currentPassword,
          newPassword,
        },
        database,
      ),
      { kind: "changed" },
    );
    const successAfter = await prisma.user.findUniqueOrThrow({
      where: { id: successUser.id },
      select: { passwordHash: true },
    });
    assert.equal(
      await verifyPassword(newPassword, successAfter.passwordHash),
      true,
    );
    assert.deepEqual(
      await Promise.all([
        prisma.passwordReset.count({ where: { userId: successUser.id } }),
        prisma.emailVerification.count({
          where: { userId: successUser.id },
        }),
      ]),
      [0, 0],
    );

    const staleUser = await createCredentialFixtures("stale");
    const concurrentPassword = "KonkurentnaIntegracija3!";
    const concurrentPasswordHash = await hashPassword(concurrentPassword);
    let comparedBeforeMutation = false;
    const staleCrypto: PasswordChangeCrypto = {
      async compareCurrentPassword(password, passwordHash) {
        const matches = await verifyPasswordConstantWork(
          password,
          passwordHash,
        );
        assert.equal(matches, true);
        comparedBeforeMutation = true;
        await prisma.user.update({
          where: { id: staleUser.id },
          data: { passwordHash: concurrentPasswordHash },
        });
        return matches;
      },
      hashNewPassword: hashPassword,
    };

    assert.deepEqual(
      await changeAuthenticatedPassword(
        {
          userId: staleUser.id,
          currentPassword,
          newPassword,
        },
        database,
        staleCrypto,
      ),
      { kind: "invalid-current-password" },
    );
    assert.equal(comparedBeforeMutation, true);
    const staleAfter = await prisma.user.findUniqueOrThrow({
      where: { id: staleUser.id },
      select: { passwordHash: true },
    });
    assert.equal(
      await verifyPassword(concurrentPassword, staleAfter.passwordHash),
      true,
    );
    assert.equal(
      await verifyPassword(newPassword, staleAfter.passwordHash),
      false,
    );
    assert.deepEqual(
      await Promise.all([
        prisma.passwordReset.count({ where: { userId: staleUser.id } }),
        prisma.emailVerification.count({
          where: { userId: staleUser.id },
        }),
      ]),
      [1, 1],
    );
  },
);
