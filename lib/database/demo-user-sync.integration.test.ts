import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  DemoUserSyncError,
  createPrismaDemoUserDatabase,
  synchronizeDemoUser,
} from "./demo-user-sync";

const RUN_DATABASE_TESTS =
  process.env.RUN_DEMO_USER_SYNC_DB_TESTS === "true";
const OLD_HASH = `$2a$12$${"a".repeat(53)}`;
const NEW_HASH = `$2b$12$${"b".repeat(53)}`;

function assertSafeTestDatabase(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() !== databaseUrl) {
    throw new Error("DATABASE_URL je obavezan za demo-user DB test.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nije validna URL adresa.");
  }
  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol)) {
    throw new Error("Demo-user test zahteva PostgreSQL.");
  }
  if (
    !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(
      parsedUrl.hostname.toLowerCase(),
    )
  ) {
    throw new Error("Demo-user DB test zahteva loopback host.");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(
      parsedUrl.pathname.replace(/^\/+/, ""),
    );
  } catch {
    throw new Error("Naziv demo-user test baze nije validan.");
  }
  if (
    !databaseName ||
    databaseName.includes("/") ||
    !/(?:^|[_-])(?:e2e|test|provera)(?:$|[_-])/i.test(databaseName) ||
    /(?:^|[_-])(?:prod|production|live)(?:$|[_-])/i.test(databaseName)
  ) {
    throw new Error("Demo-user test je odbijen van namenske test baze.");
  }
  return databaseName;
}

async function assertDatabaseIdentity(
  prisma: PrismaClient,
  expectedDatabaseName: string,
): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ databaseName: string }>>`
    SELECT current_database() AS "databaseName"
  `;
  assert.deepEqual(rows, [{ databaseName: expectedDatabaseName }]);
}

function failingSessionDeleteClient(
  prisma: PrismaClient,
): Pick<PrismaClient, "$transaction"> {
  return {
    $transaction: (<T>(
      work: (transaction: Prisma.TransactionClient) => Promise<T>,
    ) =>
      prisma.$transaction(async (transaction) => {
        const wrapped = {
          $queryRaw: transaction.$queryRaw.bind(transaction),
          user: transaction.user,
          session: {
            async deleteMany() {
              throw new Error("Injected demo Session cleanup failure");
            },
          },
          emailVerification: transaction.emailVerification,
          passwordReset: transaction.passwordReset,
        } as unknown as Prisma.TransactionClient;
        return work(wrapped);
      })) as PrismaClient["$transaction"],
  };
}

test(
  "demo user sync atomically bumps existing revision and revokes every session",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    const expectedDatabaseName = assertSafeTestDatabase();
    const { PrismaClient } = await import("@prisma/client");
    const observer = new PrismaClient();
    const failingWorker = new PrismaClient();
    const worker = new PrismaClient();
    const runId = randomUUID();
    const existingEmail = `demo-sync-existing-${runId}@example.invalid`;
    const createdEmail = `demo-sync-created-${runId}@example.invalid`;

    testContext.after(async () => {
      try {
        await observer.user.deleteMany({
          where: { email: { in: [existingEmail, createdEmail] } },
        });
      } finally {
        await Promise.allSettled([
          observer.$disconnect(),
          failingWorker.$disconnect(),
          worker.$disconnect(),
        ]);
      }
    });

    await assertDatabaseIdentity(observer, expectedDatabaseName);
    const policy = await observer.authPolicyState.findUniqueOrThrow({
      where: { id: 1 },
      select: { revision: true },
    });
    const existing = await observer.user.create({
      data: {
        email: existingEmail,
        passwordHash: OLD_HASH,
        firstName: "Old",
        lastName: "Demo",
        role: "CUSTOMER",
        authSessionRevision: 2,
      },
      select: { id: true },
    });
    const issuedAt = new Date(Math.floor(Date.now() / 1_000) * 1_000);
    const expires = new Date(issuedAt.getTime() + 60 * 60 * 1_000);
    await observer.session.createMany({
      data: [
        {
          sessionToken: `legacy-demo-${runId}`,
          userId: existing.id,
          expires,
        },
        {
          sessionToken: `v1:${randomBytes(32).toString("hex")}`,
          userId: existing.id,
          expires,
          issuedAt,
          authSessionRevision: 2,
          authPolicyRevision: policy.revision,
        },
      ],
    });
    await observer.emailVerification.create({
      data: {
        userId: existing.id,
        token: randomBytes(32).toString("hex"),
        expires,
      },
    });
    await observer.passwordReset.create({
      data: {
        userId: existing.id,
        token: randomBytes(32).toString("hex"),
        expires,
      },
    });

    const input = {
      email: existingEmail,
      firstName: "Updated",
      lastName: "Demo",
      role: "ADMIN" as const,
      passwordHash: NEW_HASH,
      verifiedAt: issuedAt,
    };
    await assert.rejects(
      synchronizeDemoUser(
        input,
        createPrismaDemoUserDatabase(
          failingSessionDeleteClient(failingWorker),
        ),
      ),
      DemoUserSyncError,
    );
    const rolledBack = await observer.user.findUniqueOrThrow({
      where: { id: existing.id },
      select: {
        authSessionRevision: true,
        passwordHash: true,
        role: true,
      },
    });
    assert.deepEqual(rolledBack, {
      authSessionRevision: 2,
      passwordHash: OLD_HASH,
      role: "CUSTOMER",
    });
    assert.equal(
      await observer.session.count({ where: { userId: existing.id } }),
      2,
    );

    assert.deepEqual(
      await synchronizeDemoUser(
        input,
        createPrismaDemoUserDatabase(worker),
      ),
      { id: existing.id, kind: "updated" },
    );
    const updated = await observer.user.findUniqueOrThrow({
      where: { id: existing.id },
      select: {
        authSessionRevision: true,
        passwordHash: true,
        role: true,
        emailVerified: true,
      },
    });
    assert.equal(updated.authSessionRevision, 3);
    assert.equal(updated.passwordHash, NEW_HASH);
    assert.equal(updated.role, "ADMIN");
    assert.equal(updated.emailVerified?.getTime(), issuedAt.getTime());
    assert.equal(
      await observer.session.count({ where: { userId: existing.id } }),
      0,
    );
    assert.equal(
      await observer.emailVerification.count({
        where: { userId: existing.id },
      }),
      0,
    );
    assert.equal(
      await observer.passwordReset.count({ where: { userId: existing.id } }),
      0,
    );

    const created = await synchronizeDemoUser(
      { ...input, email: createdEmail, role: "CUSTOMER" as const },
      createPrismaDemoUserDatabase(worker),
    );
    assert.equal(created.kind, "created");
    const createdRow = await observer.user.findUniqueOrThrow({
      where: { id: created.id },
      select: { authSessionRevision: true },
    });
    assert.equal(createdRow.authSessionRevision, 0);
    assert.equal(
      await observer.session.count({ where: { userId: created.id } }),
      0,
    );
  },
);
