import assert from "node:assert/strict";
import test from "node:test";
import {
  EmailVerificationConflictError,
  EmailVerificationExpiredError,
  commitEmailVerification,
  createStoredEmailVerificationClaim,
  prepareVerificationSuccessBeforeCommit,
} from "./email-verification";

const RAW_TOKEN = "a".repeat(64);
const TOKEN_HASH = `v1:${"b".repeat(64)}`;
const EXPECTED_USER = {
  email: "kupac@example.com",
  passwordHash: "$2b$12$test-only-not-a-production-hash-value-aaaaaaaaaaaaa",
  role: "CUSTOMER",
  firstName: "Kupac",
  lastName: "Test",
} as const;
const DATABASE_TIME = new Date("2026-08-30T12:00:00.000Z");
const TOKEN_EXPIRY = new Date("2026-08-30T12:01:00.000Z");

test("verification claim prefers the stored hash and isolates legacy fallback", () => {
  assert.deepEqual(
    createStoredEmailVerificationClaim({
      id: "verification-current",
      userId: "user-1",
      token: RAW_TOKEN,
      tokenHash: TOKEN_HASH,
      user: EXPECTED_USER,
    }),
    {
      id: "verification-current",
      userId: "user-1",
      credential: { kind: "hash", tokenHash: TOKEN_HASH },
      expectedUser: EXPECTED_USER,
    },
  );

  assert.deepEqual(
    createStoredEmailVerificationClaim({
      id: "verification-legacy",
      userId: "user-1",
      token: RAW_TOKEN,
      tokenHash: null,
      user: EXPECTED_USER,
    }),
    {
      id: "verification-legacy",
      userId: "user-1",
      credential: { kind: "legacy", token: RAW_TOKEN },
      expectedUser: EXPECTED_USER,
    },
  );

  assert.equal(
    createStoredEmailVerificationClaim({
      id: "verification-corrupt",
      userId: "user-1",
      token: RAW_TOKEN,
      tokenHash: "not-a-current-hash",
      user: EXPECTED_USER,
    }),
    null,
  );
  assert.equal(
    createStoredEmailVerificationClaim({
      id: "verification-noncanonical-legacy",
      userId: "user-1",
      token: RAW_TOKEN.toUpperCase(),
      tokenHash: null,
      user: EXPECTED_USER,
    }),
    null,
  );
});

test("verification locks User then token, uses DB time and keeps the legacy claim exact", async () => {
  const calls: Array<{ operation: string; input?: unknown }> = [];
  const database = {
    async $transaction(
      work: (transaction: {
        $queryRaw(
          strings: TemplateStringsArray,
          ...values: unknown[]
        ): Promise<unknown[]>;
        emailVerification: {
          deleteMany(input: { where: Record<string, unknown> }): Promise<{
            count: number;
          }>;
        };
        user: {
          updateMany(input: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
          }): Promise<{ count: number }>;
        };
      }) => Promise<unknown>,
    ) {
      return work({
        async $queryRaw(strings, ...values) {
          const sql = strings.join("?");
          if (sql.includes('FROM public."User"')) {
            calls.push({ operation: "query:user-for-update", input: values });
            return [
              {
                id: "user-1",
                ...EXPECTED_USER,
                emailVerified: null,
              },
            ];
          }
          if (sql.includes("clock_timestamp()")) {
            calls.push({ operation: "query:clock", input: values });
            return [{ verifiedAt: DATABASE_TIME }];
          }
          if (sql.includes('FROM public."EmailVerification"')) {
            calls.push({ operation: "query:token-for-update", input: values });
            return [
              {
                id: "verification-legacy",
                userId: "user-1",
                token: RAW_TOKEN,
                tokenHash: null,
                expires: TOKEN_EXPIRY,
              },
            ];
          }
          throw new Error("unexpected query");
        },
        emailVerification: {
          async deleteMany(input) {
            calls.push({ operation: "emailVerification:deleteMany", input });
            return { count: "id" in input.where ? 1 : 0 };
          },
        },
        user: {
          async updateMany(input) {
            calls.push({ operation: "user:updateMany", input });
            return { count: 1 };
          },
        },
      });
    },
  } as unknown as Parameters<typeof commitEmailVerification>[0];
  await commitEmailVerification(database, {
    id: "verification-legacy",
    userId: "user-1",
    credential: { kind: "legacy", token: RAW_TOKEN },
    expectedUser: EXPECTED_USER,
  });

  assert.deepEqual(calls[0], {
    operation: "query:user-for-update",
    input: ["user-1"],
  });
  assert.deepEqual(calls[1], {
    operation: "query:token-for-update",
    input: ["verification-legacy", "user-1"],
  });
  assert.deepEqual(calls[2], {
    operation: "query:clock",
    input: [],
  });
  assert.deepEqual(calls[3], {
    operation: "emailVerification:deleteMany",
    input: {
      where: {
        id: "verification-legacy",
        userId: "user-1",
        token: RAW_TOKEN,
        tokenHash: null,
      },
    },
  });
  assert.deepEqual(calls[4], {
    operation: "user:updateMany",
    input: {
      where: {
        id: "user-1",
        emailVerified: null,
        ...EXPECTED_USER,
      },
      data: {
        emailVerified: DATABASE_TIME,
        emailVerificationLoginGraceUntil: null,
        verificationEmailNextAllowedAt: null,
        verificationEmailResendWindowStartedAt: null,
        verificationEmailResendCount: null,
      },
    },
  });
  assert.deepEqual(calls[5], {
    operation: "emailVerification:deleteMany",
    input: { where: { userId: "user-1" } },
  });
});

test("verification rejects a stale JWT profile before clock or token access", async () => {
  let tokenMutationAttempted = false;
  let laterQueryAttempted = false;
  const database = {
    async $transaction(
      work: (transaction: {
        $queryRaw(
          strings: TemplateStringsArray,
          ...values: unknown[]
        ): Promise<unknown[]>;
        user: {
          updateMany(): Promise<{ count: number }>;
        };
        emailVerification: {
          deleteMany(): Promise<{ count: number }>;
        };
      }) => Promise<unknown>,
    ) {
      return work({
        async $queryRaw(strings) {
          const sql = strings.join("?");
          if (sql.includes('FROM public."User"')) {
            return [
              {
                id: "user-1",
                ...EXPECTED_USER,
                role: "ADMIN",
                emailVerified: null,
              },
            ];
          }
          laterQueryAttempted = true;
          return [];
        },
        user: {
          async updateMany() {
            return { count: 0 };
          },
        },
        emailVerification: {
          async deleteMany() {
            tokenMutationAttempted = true;
            return { count: 0 };
          },
        },
      });
    },
  } as unknown as Parameters<typeof commitEmailVerification>[0];

  await assert.rejects(
    commitEmailVerification(database, {
      id: "verification-current",
      userId: "user-1",
      credential: { kind: "hash", tokenHash: TOKEN_HASH },
      expectedUser: EXPECTED_USER,
    }),
    EmailVerificationConflictError,
  );
  assert.equal(tokenMutationAttempted, false);
  assert.equal(laterQueryAttempted, false);
});

test("verification treats DB-clock expiry as retryable expiry without mutations", async () => {
  let mutationAttempted = false;
  const database = {
    async $transaction(work: (transaction: never) => Promise<unknown>) {
      const transaction = {
        async $queryRaw(strings: TemplateStringsArray) {
          const sql = strings.join("?");
          if (sql.includes('FROM public."User"')) {
            return [{ id: "user-1", ...EXPECTED_USER, emailVerified: null }];
          }
          if (sql.includes("clock_timestamp()")) {
            return [{ verifiedAt: DATABASE_TIME }];
          }
          return [
            {
              id: "verification-current",
              userId: "user-1",
              token: null,
              tokenHash: TOKEN_HASH,
              expires: DATABASE_TIME,
            },
          ];
        },
        emailVerification: {
          async deleteMany() {
            mutationAttempted = true;
            return { count: 0 };
          },
        },
        user: {
          async updateMany() {
            mutationAttempted = true;
            return { count: 0 };
          },
        },
      };
      return work(transaction as never);
    },
  } as unknown as Parameters<typeof commitEmailVerification>[0];

  await assert.rejects(
    commitEmailVerification(database, {
      id: "verification-current",
      userId: "user-1",
      credential: { kind: "hash", tokenHash: TOKEN_HASH },
      expectedUser: EXPECTED_USER,
    }),
    EmailVerificationExpiredError,
  );
  assert.equal(mutationAttempted, false);
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
