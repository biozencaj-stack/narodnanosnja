import assert from "node:assert/strict";
import test from "node:test";
import {
  DemoUserSyncError,
  synchronizeDemoUser,
  type DemoUserDatabase,
  type DemoUserTransaction,
} from "./demo-user-sync";

const PASSWORD_HASH = `$2b$12$${"a".repeat(53)}`;
const VERIFIED_AT = new Date("2026-08-30T12:00:00.000Z");

function validInput() {
  return {
    email: "admin@demo.rs",
    firstName: "Admin",
    lastName: "Demo",
    role: "ADMIN" as const,
    passwordHash: PASSWORD_HASH,
    verifiedAt: new Date(VERIFIED_AT.getTime()),
  };
}

function createHarness(
  existing: Readonly<{ id: string; authSessionRevision: number }> | null,
  options: { updateResult?: boolean; failAt?: string } = {},
) {
  const events: string[] = [];
  const updates: unknown[][] = [];
  const creates: unknown[] = [];
  let transactionCalls = 0;

  function maybeFail(stage: string): void {
    if (options.failAt === stage) throw new Error(`Injected ${stage} failure`);
  }

  const transaction: DemoUserTransaction = {
    async lockUserByEmail(email) {
      events.push(`lock:${email}`);
      maybeFail("lock");
      return existing;
    },
    async createUser(input) {
      events.push("create-user");
      creates.push(input);
      maybeFail("create-user");
      return { id: "created-user" };
    },
    async updateUserSecurity(...input) {
      events.push("update-user");
      updates.push(input);
      maybeFail("update-user");
      return options.updateResult ?? true;
    },
    async deleteSessions(userId) {
      events.push(`delete-sessions:${userId}`);
      maybeFail("delete-sessions");
    },
    async deleteEmailVerifications(userId) {
      events.push(`delete-verifications:${userId}`);
      maybeFail("delete-verifications");
    },
    async deletePasswordResets(userId) {
      events.push(`delete-resets:${userId}`);
      maybeFail("delete-resets");
    },
  };
  const database: DemoUserDatabase = {
    async transaction(work) {
      transactionCalls += 1;
      return work(transaction);
    },
  };

  return {
    database,
    events,
    updates,
    creates,
    get transactionCalls() {
      return transactionCalls;
    },
  };
}

test("existing demo credential bumps revision and revokes sessions before cleanup", async () => {
  const harness = createHarness({ id: "user-1", authSessionRevision: 4 });
  const input = validInput();

  assert.deepEqual(await synchronizeDemoUser(input, harness.database), {
    id: "user-1",
    kind: "updated",
  });
  assert.deepEqual(harness.events, [
    "lock:admin@demo.rs",
    "update-user",
    "delete-sessions:user-1",
    "delete-verifications:user-1",
    "delete-resets:user-1",
  ]);
  assert.equal(harness.updates.length, 1);
  const [userId, expectedRevision, nextRevision, write] =
    harness.updates[0] as [string, number, number, ReturnType<typeof validInput>];
  assert.equal(userId, "user-1");
  assert.equal(expectedRevision, 4);
  assert.equal(nextRevision, 5);
  assert.equal(write.email, "admin@demo.rs");
  assert.notEqual(write.verifiedAt, input.verifiedAt);
  assert.equal(write.verifiedAt.getTime(), VERIFIED_AT.getTime());
});

test("new demo user starts at revision zero without a fake revocation", async () => {
  const harness = createHarness(null);

  assert.deepEqual(await synchronizeDemoUser(validInput(), harness.database), {
    id: "created-user",
    kind: "created",
  });
  assert.deepEqual(harness.events, [
    "lock:admin@demo.rs",
    "create-user",
    "delete-verifications:created-user",
    "delete-resets:created-user",
  ]);
  assert.equal(harness.creates.length, 1);
  assert.equal(
    (harness.creates[0] as { authSessionRevision: number })
      .authSessionRevision,
    0,
  );
});

test("revision CAS loss and session cleanup failure stay coarse and stop credentials cleanup", async () => {
  for (const harness of [
    createHarness(
      { id: "user-1", authSessionRevision: 1 },
      { updateResult: false },
    ),
    createHarness(
      { id: "user-1", authSessionRevision: 1 },
      { failAt: "delete-sessions" },
    ),
    createHarness({
      id: "user-1",
      authSessionRevision: 2_147_483_647,
    }),
  ]) {
    await assert.rejects(
      synchronizeDemoUser(validInput(), harness.database),
      (error) =>
        error instanceof DemoUserSyncError &&
        error.message === "Demo user synchronization failed",
    );
    assert.equal(
      harness.events.some((event) => event.startsWith("delete-verifications")),
      false,
    );
    assert.equal(
      harness.events.some((event) => event.startsWith("delete-resets")),
      false,
    );
  }
});

test("untrusted demo values fail before opening a transaction", async () => {
  for (const input of [
    { ...validInput(), email: "Admin@demo.rs" },
    { ...validInput(), firstName: " Admin" },
    { ...validInput(), role: "OWNER" },
    { ...validInput(), passwordHash: "not-bcrypt" },
    { ...validInput(), verifiedAt: new Date(Number.NaN) },
  ]) {
    const harness = createHarness(null);
    await assert.rejects(
      synchronizeDemoUser(input, harness.database),
      DemoUserSyncError,
    );
    assert.equal(harness.transactionCalls, 0);
  }
});
