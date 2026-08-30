import assert from "node:assert/strict";
import test from "node:test";
import {
  commitEmailVerification,
  createStoredEmailVerificationClaim,
  prepareVerificationSuccessBeforeCommit,
} from "./email-verification";

const RAW_TOKEN = "a".repeat(64);
const TOKEN_HASH = `v1:${"b".repeat(64)}`;

test("verification claim prefers the stored hash and isolates legacy fallback", () => {
  assert.deepEqual(
    createStoredEmailVerificationClaim({
      id: "verification-current",
      userId: "user-1",
      token: RAW_TOKEN,
      tokenHash: TOKEN_HASH,
    }),
    {
      id: "verification-current",
      userId: "user-1",
      credential: { kind: "hash", tokenHash: TOKEN_HASH },
    },
  );

  assert.deepEqual(
    createStoredEmailVerificationClaim({
      id: "verification-legacy",
      userId: "user-1",
      token: RAW_TOKEN,
      tokenHash: null,
    }),
    {
      id: "verification-legacy",
      userId: "user-1",
      credential: { kind: "legacy", token: RAW_TOKEN },
    },
  );

  assert.equal(
    createStoredEmailVerificationClaim({
      id: "verification-corrupt",
      userId: "user-1",
      token: RAW_TOKEN,
      tokenHash: "not-a-current-hash",
    }),
    null,
  );
  assert.equal(
    createStoredEmailVerificationClaim({
      id: "verification-noncanonical-legacy",
      userId: "user-1",
      token: RAW_TOKEN.toUpperCase(),
      tokenHash: null,
    }),
    null,
  );
});

test("legacy verification claim remains conditional on an empty hash column", async () => {
  const calls: Array<{ operation: string; input?: unknown }> = [];
  const database = {
    async $transaction(
      work: (transaction: {
        emailVerification: {
          deleteMany(input: { where: Record<string, unknown> }): Promise<{
            count: number;
          }>;
        };
        user: {
          update(input: { where: unknown; data: unknown }): Promise<unknown>;
        };
      }) => Promise<unknown>,
    ) {
      return work({
        emailVerification: {
          async deleteMany(input) {
            calls.push({ operation: "emailVerification:deleteMany", input });
            return { count: "id" in input.where ? 1 : 0 };
          },
        },
        user: {
          async update(input) {
            calls.push({ operation: "user:update", input });
            return {};
          },
        },
      });
    },
  } as unknown as Parameters<typeof commitEmailVerification>[0];
  const verifiedAt = new Date("2026-08-30T12:00:00.000Z");

  await commitEmailVerification(
    database,
    {
      id: "verification-legacy",
      userId: "user-1",
      credential: { kind: "legacy", token: RAW_TOKEN },
    },
    verifiedAt,
  );

  assert.deepEqual(calls[0], {
    operation: "emailVerification:deleteMany",
    input: {
      where: {
        id: "verification-legacy",
        userId: "user-1",
        token: RAW_TOKEN,
        tokenHash: null,
        expires: { gt: verifiedAt },
      },
    },
  });
});

test("verification prepares the complete response before committing user mutations", async () => {
  const calls: string[] = [];

  const response = await prepareVerificationSuccessBeforeCommit(
    async () => {
      calls.push("session");
      return "signed-session";
    },
    async (sessionToken) => {
      calls.push("response");
      return { sessionToken };
    },
    async () => {
      calls.push("commit");
    },
  );

  assert.deepEqual(response, { sessionToken: "signed-session" });
  assert.deepEqual(calls, ["session", "response", "commit"]);
});

test("verification never mutates the database when session encoding fails", async () => {
  let prepared = false;
  let committed = false;

  await assert.rejects(
    prepareVerificationSuccessBeforeCommit(
      async () => {
        throw new Error("encode failed");
      },
      async () => {
        prepared = true;
        return "response";
      },
      async () => {
        committed = true;
      },
    ),
    /encode failed/,
  );

  assert.equal(prepared, false);
  assert.equal(committed, false);
});

test("verification never mutates the database when response preparation fails", async () => {
  let committed = false;

  await assert.rejects(
    prepareVerificationSuccessBeforeCommit(
      async () => "signed-session",
      async () => {
        throw new Error("response failed");
      },
      async () => {
        committed = true;
      },
    ),
    /response failed/,
  );

  assert.equal(committed, false);
});

test("verification does not return a response when the atomic commit fails", async () => {
  await assert.rejects(
    prepareVerificationSuccessBeforeCommit(
      async () => "signed-session",
      async () => "prepared-response",
      async () => {
        throw new Error("commit failed");
      },
    ),
    /commit failed/,
  );
});
