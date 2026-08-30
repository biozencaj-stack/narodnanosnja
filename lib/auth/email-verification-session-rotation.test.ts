import assert from "node:assert/strict";
import test from "node:test";
import {
  EmailVerificationConflictError,
  EmailVerificationExpiredError,
  type EmailVerificationClaim,
} from "./email-verification";
import {
  EmailVerificationSessionRotationUnavailableError,
  commitEmailVerificationSessionRotation,
} from "./email-verification-session-rotation";

const SECRET = "s".repeat(32);
const SID = "A".repeat(43);
const VERIFIED_AT = new Date("2026-08-30T12:00:00.789Z");
const EXPIRES_AT = new Date("2026-08-30T12:05:00.000Z");
const CLAIM: EmailVerificationClaim = {
  id: "verification-1",
  userId: "user-1",
  credential: { kind: "hash", tokenHash: `v1:${"b".repeat(64)}` },
  expectedUser: {
    email: "kupac@example.com",
    passwordHash: "$2b$12$test-only-not-a-production-hash-value-aaaaaaaaaaaaa",
    role: "CUSTOMER",
    firstName: "Kupac",
    lastName: "Test",
  },
};

type HarnessOptions = {
  user?: Record<string, unknown>;
  policy?: Record<string, unknown>;
  credential?: Record<string, unknown>;
  clock?: Date;
  policyCount?: number | bigint;
  insertError?: boolean;
  consumeCount?: number;
};

function createHarness(options: HarnessOptions = {}) {
  const calls: string[] = [];
  const rawSql: string[] = [];
  let rolledBack = false;
  let transactionCount = 0;
  const user = {
    id: CLAIM.userId,
    ...CLAIM.expectedUser,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    emailVerified: null,
    authSessionRevision: 6,
    ...options.user,
  };
  const policy = {
    policyId: 1,
    policyRevision: 4,
    policy: "audit",
    stagedGraceDeadline: null,
    policyCreatedAt: new Date("2026-08-01T00:00:00.000Z"),
    policyUpdatedAt: new Date("2026-08-01T00:00:00.000Z"),
    policyCount: options.policyCount ?? 1,
    ...options.policy,
  };
  const credential = {
    id: CLAIM.id,
    userId: CLAIM.userId,
    token: null,
    tokenHash: (CLAIM.credential as { tokenHash: string }).tokenHash,
    expires: EXPIRES_AT,
    ...options.credential,
  };

  const transaction = {
    async $queryRaw(strings: TemplateStringsArray) {
      const sql = strings.join("?");
      rawSql.push(sql);
      if (sql.includes('FROM public."User"')) {
        calls.push("lock:user");
        return [user];
      }
      if (sql.includes('FROM public."AuthPolicyState"')) {
        calls.push("lock:policy");
        return [policy];
      }
      if (sql.includes('FROM public."EmailVerification"')) {
        calls.push("lock:credential");
        return [credential];
      }
      if (sql.includes("clock_timestamp()")) {
        calls.push("clock");
        return [{ verifiedAt: options.clock ?? VERIFIED_AT }];
      }
      throw new Error("unexpected raw query");
    },
    user: {
      async updateMany(input: unknown) {
        calls.push("write:user");
        return { count: 1, input };
      },
    },
    session: {
      async deleteMany() {
        calls.push("write:revoke-sessions");
        return { count: 2 };
      },
      async create(input: unknown) {
        calls.push("write:insert-session");
        if (options.insertError) throw new Error("simulated insert error");
        return { id: "new-session", input };
      },
    },
    emailVerification: {
      async deleteMany(input: { where: Record<string, unknown> }) {
        if ("id" in input.where) {
          calls.push("write:consume");
          return { count: options.consumeCount ?? 1 };
        }
        calls.push("write:clean-siblings");
        return { count: 1 };
      },
    },
  };
  const database = {
    async $transaction<T>(work: (tx: typeof transaction) => Promise<T>) {
      transactionCount += 1;
      try {
        return await work(transaction);
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    },
  };
  return {
    calls,
    database,
    transaction,
    rawSql,
    get rolledBack() {
      return rolledBack;
    },
    get transactionCount() {
      return transactionCount;
    },
  };
}

test("rotation locks User, policy, credential; prepares before writes; stores only V2 metadata", async () => {
  const harness = createHarness();
  let callbackInput:
    | Parameters<NonNullable<Parameters<typeof commitEmailVerificationSessionRotation>[2]["prepareSuccessResult"]>>[0]
    | undefined;

  const response = await commitEmailVerificationSessionRotation(
    harness.database as never,
    CLAIM,
    {
      secret: SECRET,
      sid: SID,
      async prepareSuccessResult(input) {
        harness.calls.push("prepare");
        callbackInput = input;
        return { cookie: "prepared" };
      },
    },
  );

  assert.deepEqual(response, { cookie: "prepared" });
  assert.deepEqual(harness.calls, [
    "lock:user",
    "lock:policy",
    "lock:credential",
    "clock",
    "prepare",
    "write:user",
    "write:revoke-sessions",
    "write:insert-session",
    "write:consume",
    "write:clean-siblings",
  ]);
  assert.ok(callbackInput);
  assert.equal(callbackInput.claims.sid, SID);
  assert.equal(callbackInput.claims.ur, 7);
  assert.equal(callbackInput.claims.pr, 4);
  assert.equal(
    callbackInput.claims.sat,
    Math.floor(VERIFIED_AT.getTime() / 1_000),
  );
  assert.equal(callbackInput.claims.sae - callbackInput.claims.sat, 86_400);
  assert.equal(callbackInput.user.email, CLAIM.expectedUser.email);
  assert.match(harness.rawSql[0] ?? "", /FOR UPDATE/);
  assert.match(harness.rawSql[1] ?? "", /"AuthPolicyState"/);
  assert.match(harness.rawSql[1] ?? "", /count\(\*\)/);
  assert.match(harness.rawSql[1] ?? "", /FOR SHARE/);
  assert.match(harness.rawSql[2] ?? "", /"EmailVerification"/);
  assert.match(
    harness.rawSql[3] ?? "",
    /clock_timestamp\(\) AT TIME ZONE 'UTC'\)::timestamp\(3\)/,
  );
});

test("preparation failure is coarse and causes no writes", async () => {
  const harness = createHarness();
  await assert.rejects(
    commitEmailVerificationSessionRotation(harness.database as never, CLAIM, {
      secret: SECRET,
      sid: SID,
      async prepareSuccessResult() {
        harness.calls.push("prepare");
        throw new Error("JWE failure must not escape");
      },
    }),
    EmailVerificationSessionRotationUnavailableError,
  );
  assert.deepEqual(harness.calls, [
    "lock:user",
    "lock:policy",
    "lock:credential",
    "clock",
    "prepare",
  ]);
  assert.equal(harness.rolledBack, true);
});

test("expired credential remains an explicit expiry and is never written", async () => {
  const harness = createHarness({ credential: { expires: VERIFIED_AT } });
  await assert.rejects(
    commitEmailVerificationSessionRotation(harness.database as never, CLAIM, {
      secret: SECRET,
      sid: SID,
      prepareSuccessResult: () => "never",
    }),
    EmailVerificationExpiredError,
  );
  assert.deepEqual(harness.calls, [
    "lock:user",
    "lock:policy",
    "lock:credential",
    "clock",
  ]);
});

test("malformed DB policy and revision overflow fail closed before preparation", async () => {
  for (const options of [
    { policy: { policy: "not-a-policy" } },
    { policy: { policyRevision: 2_147_483_648 } },
    { user: { authSessionRevision: 2_147_483_647 } },
  ]) {
    const harness = createHarness(options);
    await assert.rejects(
      commitEmailVerificationSessionRotation(harness.database as never, CLAIM, {
        secret: SECRET,
        sid: SID,
        prepareSuccessResult: () => "never",
      }),
      EmailVerificationSessionRotationUnavailableError,
    );
    assert.equal(harness.calls.includes("prepare"), false);
    assert.equal(harness.calls.some((call) => call.startsWith("write:")), false);
  }
});

test("invalid HMAC secret or SID is coarse and never opens a transaction", async () => {
  for (const rotationOptions of [
    { secret: "short", sid: SID },
    { secret: SECRET, sid: "not-a-canonical-sid" },
  ]) {
    const harness = createHarness();
    await assert.rejects(
      commitEmailVerificationSessionRotation(harness.database as never, CLAIM, {
        ...rotationOptions,
        prepareSuccessResult: () => "never",
      }),
      EmailVerificationSessionRotationUnavailableError,
    );
    assert.equal(harness.transactionCount, 0);
    assert.deepEqual(harness.calls, []);
  }
});

test("Session insertion and exact credential cleanup errors roll the complete transaction back", async () => {
  for (const options of [
    { insertError: true },
    { consumeCount: 0 },
  ]) {
    const harness = createHarness(options);
    const expected = options.consumeCount === 0
      ? EmailVerificationConflictError
      : EmailVerificationSessionRotationUnavailableError;
    await assert.rejects(
      commitEmailVerificationSessionRotation(harness.database as never, CLAIM, {
        secret: SECRET,
        sid: SID,
        prepareSuccessResult: () => "prepared",
      }),
      expected,
    );
    assert.equal(harness.rolledBack, true);
    assert.equal(harness.calls.includes("write:user"), true);
    assert.equal(harness.calls.includes("write:revoke-sessions"), true);
    assert.equal(harness.calls.includes("write:insert-session"), true);
    if (options.insertError) {
      assert.equal(harness.calls.includes("write:consume"), false);
    } else {
      assert.equal(harness.calls.includes("write:clean-siblings"), false);
    }
  }
});
