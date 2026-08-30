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
const ACTIVE_EXPIRES = new Date("2026-08-30T12:01:00.000Z");

function createDatabase(
  claimCount = 1,
  storedCredential: { token: string | null; tokenHash: string | null } = {
    token: null,
    tokenHash: "v1:stored-hash",
  },
  sessionDeleteFailure = false,
  sessionDeleteCount = 2,
  userUpdateCount = 1,
) {
  const calls: Array<{ operation: string; input?: unknown }> = [];
  const database: PasswordResetConfirmDatabase = {
    async $transaction(work) {
      calls.push({ operation: "transaction:start" });
      try {
        const result = await work({
          async $queryRaw(strings, ...values) {
            const sql = strings.join("?");
            if (sql.includes('FROM public."User"')) {
              calls.push({ operation: "query:user-for-update", input: values });
              return [{ id: "user-id" }] as never;
            }
            if (sql.includes('FROM public."PasswordReset"')) {
              calls.push({ operation: "query:reset-for-update", input: values });
              return [
                {
                  id: "reset-id",
                  userId: "user-id",
                  ...storedCredential,
                  expires: ACTIVE_EXPIRES,
                },
              ] as never;
            }
            if (sql.includes("clock_timestamp()")) {
              calls.push({ operation: "query:clock", input: values });
              return [{ resetAt: RESET_AT }] as never;
            }
            throw new Error("unexpected raw query");
          },
          emailVerification: {
            async deleteMany(input) {
              calls.push({ operation: "emailVerification:deleteMany", input });
              return { count: 1 };
            },
          },
          passwordReset: {
            async deleteMany(input) {
              calls.push({ operation: "passwordReset:deleteMany", input });
              return {
                count: "id" in input.where ? claimCount : 2,
              };
            },
          },
          session: {
            async deleteMany(input) {
              calls.push({ operation: "session:deleteMany", input });
              if (sessionDeleteFailure) {
                throw new Error("Injected session revocation failure");
              }
              return { count: sessionDeleteCount };
            },
          },
          user: {
            async updateMany(input) {
              calls.push({ operation: "user:updateMany", input });
              return { count: userUpdateCount };
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

test("current hash uses User-first ordering and rolls back the prepared password on claim loss", async () => {
  const { database, calls } = createDatabase();
  await commitPasswordResetConfirmation(
    database,
    claim({ kind: "current-hash", storedValue: "v1:stored-hash" }),
    PASSWORD_HASH,
  );

  assert.deepEqual(calls, [
    { operation: "transaction:start" },
    {
      operation: "query:user-for-update",
      input: ["user-id"],
    },
    {
      operation: "query:reset-for-update",
      input: ["reset-id", "user-id"],
    },
    { operation: "query:clock", input: [] },
    {
      operation: "user:updateMany",
      input: {
        where: { id: "user-id" },
        data: {
          passwordHash: PASSWORD_HASH,
          authSessionRevision: { increment: 1 },
        },
      },
    },
    {
      operation: "session:deleteMany",
      input: { where: { userId: "user-id" } },
    },
    {
      operation: "passwordReset:deleteMany",
      input: {
        where: {
          id: "reset-id",
          userId: "user-id",
          tokenHash: "v1:stored-hash",
        },
      },
    },
    {
      operation: "passwordReset:deleteMany",
      input: { where: { userId: "user-id" } },
    },
    {
      operation: "emailVerification:deleteMany",
      input: { where: { userId: "user-id" } },
    },
    { operation: "transaction:commit" },
  ]);
});

test("legacy claim uses the exact stored plaintext value, never an assumed hash field", async () => {
  const { database, calls } = createDatabase(1, {
    token: "stored-legacy-token",
    tokenHash: null,
  });
  await commitPasswordResetConfirmation(
    database,
    claim({ kind: "legacy-plaintext", storedValue: "stored-legacy-token" }),
    PASSWORD_HASH,
  );

  assert.deepEqual(calls[6], {
    operation: "passwordReset:deleteMany",
    input: {
      where: {
        id: "reset-id",
        userId: "user-id",
        token: "stored-legacy-token",
        tokenHash: null,
      },
    },
  });
});

test("a lost claim rolls back password revision and session revocation", async () => {
  const { database, calls } = createDatabase(0, {
    token: null,
    tokenHash: "v1:lost-race",
  });

  await assert.rejects(
    commitPasswordResetConfirmation(
      database,
      claim({ kind: "current-hash", storedValue: "v1:lost-race" }),
      PASSWORD_HASH,
    ),
    PasswordResetConfirmConflictError,
  );

  assert.deepEqual(
    calls.map(({ operation }) => operation),
    [
      "transaction:start",
      "query:user-for-update",
      "query:reset-for-update",
      "query:clock",
      "user:updateMany",
      "session:deleteMany",
      "passwordReset:deleteMany",
      "transaction:rollback",
    ],
  );
});

test("session revocation failure rolls back the password revision before credential cleanup", async () => {
  const { database, calls } = createDatabase(
    1,
    { token: null, tokenHash: "v1:stored-hash" },
    true,
  );

  await assert.rejects(
    commitPasswordResetConfirmation(
      database,
      claim({ kind: "current-hash", storedValue: "v1:stored-hash" }),
      PASSWORD_HASH,
    ),
    /Injected session revocation failure/,
  );
  assert.deepEqual(
    calls.map(({ operation }) => operation),
    [
      "transaction:start",
      "query:user-for-update",
      "query:reset-for-update",
      "query:clock",
      "user:updateMany",
      "session:deleteMany",
      "transaction:rollback",
    ],
  );
});

test("zero existing sessions is a successful idempotent revocation", async () => {
  const { database, calls } = createDatabase(
    1,
    { token: null, tokenHash: "v1:stored-hash" },
    false,
    0,
  );

  await commitPasswordResetConfirmation(
    database,
    claim({ kind: "current-hash", storedValue: "v1:stored-hash" }),
    PASSWORD_HASH,
  );
  assert.equal(calls.at(-1)?.operation, "transaction:commit");
});

test("a failed password revision CAS rolls back before Session deletion", async () => {
  const { database, calls } = createDatabase(
    1,
    { token: null, tokenHash: "v1:stored-hash" },
    false,
    2,
    0,
  );

  await assert.rejects(
    commitPasswordResetConfirmation(
      database,
      claim({ kind: "current-hash", storedValue: "v1:stored-hash" }),
      PASSWORD_HASH,
    ),
    PasswordResetConfirmConflictError,
  );
  assert.deepEqual(
    calls.map(({ operation }) => operation),
    [
      "transaction:start",
      "query:user-for-update",
      "query:reset-for-update",
      "query:clock",
      "user:updateMany",
      "transaction:rollback",
    ],
  );
});
