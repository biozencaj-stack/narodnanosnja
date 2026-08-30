import assert from "node:assert/strict";
import test from "node:test";
import {
  PasswordResetConfirmConflictError,
  commitPasswordResetConfirmation,
  type PasswordResetConfirmClaim,
  type PasswordResetConfirmDatabase,
} from "./password-reset-confirm";

const RESET_AT = new Date("2026-08-30T12:00:00.000Z");
const PASSWORD_HASH = "bcrypt-hash-prepared-before-transaction";

function createDatabase(claimCount = 1) {
  const calls: Array<{ operation: string; input?: unknown }> = [];
  const database: PasswordResetConfirmDatabase = {
    async $transaction(work) {
      calls.push({ operation: "transaction:start" });
      try {
        const result = await work({
          passwordReset: {
            async deleteMany(input) {
              calls.push({ operation: "passwordReset:deleteMany", input });
              return {
                count: "id" in input.where ? claimCount : 2,
              };
            },
          },
          user: {
            async update(input) {
              calls.push({ operation: "user:update", input });
              return {};
            },
          },
        });
        calls.push({ operation: "transaction:commit" });
        return result;
      } catch (error) {
        calls.push({ operation: "transaction:rollback" });
        throw error;
      }
    },
  };
  return { database, calls };
}

function claim(
  credential: PasswordResetConfirmClaim["credential"],
): PasswordResetConfirmClaim {
  return {
    id: "reset-id",
    userId: "user-id",
    credential,
  };
}

test("current hash is conditionally claimed before password update and sibling cleanup", async () => {
  const { database, calls } = createDatabase();
  await commitPasswordResetConfirmation(
    database,
    claim({ kind: "current-hash", storedValue: "v1:stored-hash" }),
    PASSWORD_HASH,
    RESET_AT,
  );

  assert.deepEqual(calls, [
    { operation: "transaction:start" },
    {
      operation: "passwordReset:deleteMany",
      input: {
        where: {
          id: "reset-id",
          userId: "user-id",
          expires: { gt: RESET_AT },
          tokenHash: "v1:stored-hash",
        },
      },
    },
    {
      operation: "user:update",
      input: {
        where: { id: "user-id" },
        data: { passwordHash: PASSWORD_HASH },
      },
    },
    {
      operation: "passwordReset:deleteMany",
      input: { where: { userId: "user-id" } },
    },
    { operation: "transaction:commit" },
  ]);
});

test("legacy claim uses the exact stored plaintext value, never an assumed hash field", async () => {
  const { database, calls } = createDatabase();
  await commitPasswordResetConfirmation(
    database,
    claim({ kind: "legacy-plaintext", storedValue: "stored-legacy-token" }),
    PASSWORD_HASH,
    RESET_AT,
  );

  assert.deepEqual(calls[1], {
    operation: "passwordReset:deleteMany",
    input: {
      where: {
        id: "reset-id",
        userId: "user-id",
        expires: { gt: RESET_AT },
        token: "stored-legacy-token",
        tokenHash: null,
      },
    },
  });
});

test("a lost claim rolls back and never changes the password or siblings", async () => {
  const { database, calls } = createDatabase(0);

  await assert.rejects(
    commitPasswordResetConfirmation(
      database,
      claim({ kind: "current-hash", storedValue: "v1:lost-race" }),
      PASSWORD_HASH,
      RESET_AT,
    ),
    PasswordResetConfirmConflictError,
  );

  assert.deepEqual(
    calls.map(({ operation }) => operation),
    [
      "transaction:start",
      "passwordReset:deleteMany",
      "transaction:rollback",
    ],
  );
});
