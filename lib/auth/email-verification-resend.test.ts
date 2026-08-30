import assert from "node:assert/strict";
import test from "node:test";
import { hashCredentialToken } from "./credential-token";
import {
  EMAIL_VERIFICATION_RESEND_ACCEPTED_MESSAGE,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  EMAIL_VERIFICATION_RESEND_MAX_EMAILS_PER_WINDOW,
  EMAIL_VERIFICATION_RESEND_TOKEN_LIFETIME_MS,
  EMAIL_VERIFICATION_RESEND_UNAVAILABLE_MESSAGE,
  EMAIL_VERIFICATION_RESEND_WINDOW_MS,
  acceptEmailVerificationResend,
  commitEmailVerificationResend,
  normalizeEmailVerificationResendEmail,
  processEmailVerificationResend,
  type EmailVerificationResendDependencies,
  type EmailVerificationResendFailure,
  type EmailVerificationResendTokenInput,
} from "./email-verification-resend";

const RAW_TOKEN = "a".repeat(64);
const TOKEN_HASH = hashCredentialToken("email-verification", RAW_TOKEN);
if (!TOKEN_HASH) throw new Error("Test token must produce a hash");
const USER = {
  id: "user-1",
  email: "kupac@example.com",
  firstName: "Kupac",
  emailVerified: null,
};

test("resend email normalization is strict and canonical", () => {
  assert.equal(
    normalizeEmailVerificationResendEmail("  KUPAC@Example.COM "),
    "kupac@example.com",
  );
  assert.equal(normalizeEmailVerificationResendEmail(undefined), null);
  assert.equal(normalizeEmailVerificationResendEmail("bez-domena@"), null);
  assert.equal(
    normalizeEmailVerificationResendEmail(`${"a".repeat(250)}@x.test`),
    null,
  );
});

test("accepted resend schedules private work without waiting for it", async () => {
  let scheduledTask: (() => Promise<void>) | undefined;
  let workFinished = false;
  const failures: EmailVerificationResendFailure[] = [];

  const result = acceptEmailVerificationResend({
    schedule(task) {
      scheduledTask = task;
    },
    async work() {
      workFinished = true;
    },
    reportFailure(failure) {
      failures.push(failure);
    },
  });

  assert.deepEqual(result, {
    status: 202,
    body: { message: EMAIL_VERIFICATION_RESEND_ACCEPTED_MESSAGE },
  });
  assert.equal(workFinished, false);
  assert.ok(scheduledTask);
  await scheduledTask();
  assert.equal(workFinished, true);
  assert.deepEqual(failures, []);
});

test("only synchronous scheduling failure changes a valid resend to 503", () => {
  const failures: EmailVerificationResendFailure[] = [];
  const result = acceptEmailVerificationResend({
    schedule() {
      throw new Error("scheduler unavailable");
    },
    async work() {
      throw new Error("must not run");
    },
    reportFailure(failure) {
      failures.push(failure);
    },
  });

  assert.deepEqual(result, {
    status: 503,
    body: { error: EMAIL_VERIFICATION_RESEND_UNAVAILABLE_MESSAGE },
  });
  assert.deepEqual(failures, [{ stage: "SCHEDULING" }]);
});

function processorDependencies(
  calls: string[],
  failures: EmailVerificationResendFailure[],
  overrides: Partial<EmailVerificationResendDependencies> = {},
): EmailVerificationResendDependencies {
  return {
    async findUserByEmail(email) {
      calls.push(`lookup:${email}`);
      return USER;
    },
    generateToken() {
      calls.push("generate");
      return RAW_TOKEN;
    },
    hashToken(token) {
      calls.push(`hash:${token}`);
      return TOKEN_HASH;
    },
    prepareDelivery(email, firstName, token) {
      calls.push(`prepare:${email}:${firstName}:${token}`);
      return async () => {
        calls.push("deliver");
      };
    },
    async replaceTokenIfEligible(input) {
      calls.push(`replace:${JSON.stringify(input)}`);
      return true;
    },
    reportFailure(failure) {
      failures.push(failure);
    },
    ...overrides,
  };
}

test("resend prepares delivery before DB mutation and sends only after commit", async () => {
  const calls: string[] = [];
  const failures: EmailVerificationResendFailure[] = [];

  await processEmailVerificationResend(
    "kupac@example.com",
    processorDependencies(calls, failures),
  );

  assert.deepEqual(calls, [
    "lookup:kupac@example.com",
    "generate",
    `hash:${RAW_TOKEN}`,
    `prepare:kupac@example.com:Kupac:${RAW_TOKEN}`,
    `replace:${JSON.stringify({
      userId: "user-1",
      expectedEmail: "kupac@example.com",
      legacyPlaintextToken: RAW_TOKEN,
      tokenHash: TOKEN_HASH,
    })}`,
    "deliver",
  ]);
  assert.deepEqual(failures, []);
});

test("absent and already verified accounts are private no-ops", async () => {
  for (const user of [
    null,
    { ...USER, emailVerified: new Date("2026-08-30T10:00:00.000Z") },
  ]) {
    const calls: string[] = [];
    const failures: EmailVerificationResendFailure[] = [];
    await processEmailVerificationResend(
      "kupac@example.com",
      processorDependencies(calls, failures, {
        async findUserByEmail() {
          calls.push("lookup");
          return user;
        },
      }),
    );

    assert.deepEqual(calls, ["lookup"]);
    assert.deepEqual(failures, []);
  }
});

test("cooldown loss never starts SMTP delivery", async () => {
  const calls: string[] = [];
  const failures: EmailVerificationResendFailure[] = [];
  await processEmailVerificationResend(
    "kupac@example.com",
    processorDependencies(calls, failures, {
      async replaceTokenIfEligible() {
        calls.push("replace:no-op");
        return false;
      },
    }),
  );

  assert.equal(calls.at(-1), "replace:no-op");
  assert.equal(calls.includes("deliver"), false);
  assert.deepEqual(failures, []);
});

test("delivery preparation failure leaves the database untouched", async () => {
  const calls: string[] = [];
  const failures: EmailVerificationResendFailure[] = [];
  await processEmailVerificationResend(
    "kupac@example.com",
    processorDependencies(calls, failures, {
      prepareDelivery() {
        calls.push("prepare:failed");
        throw new Error("invalid storefront configuration");
      },
      async replaceTokenIfEligible() {
        calls.push("replace");
        return true;
      },
    }),
  );

  assert.equal(calls.includes("replace"), false);
  assert.deepEqual(failures, [{ stage: "DELIVERY_PREPARATION" }]);
});

test("noncanonical raw tokens and hashes fail before delivery or persistence", async () => {
  for (const overrides of [
    {
      generateToken: () => RAW_TOKEN.toUpperCase(),
    },
    {
      hashToken: () => "legacy-or-malformed-hash",
    },
    {
      hashToken: () => `v1:${"b".repeat(64)}`,
    },
  ]) {
    const calls: string[] = [];
    const failures: EmailVerificationResendFailure[] = [];
    await processEmailVerificationResend(
      "kupac@example.com",
      processorDependencies(calls, failures, {
        ...overrides,
        prepareDelivery() {
          calls.push("prepare");
          return async () => undefined;
        },
        async replaceTokenIfEligible() {
          calls.push("replace");
          return true;
        },
      }),
    );

    assert.equal(calls.includes("prepare"), false);
    assert.equal(calls.includes("replace"), false);
    assert.deepEqual(failures, [{ stage: "TOKEN_PREPARATION" }]);
  }
});

test("ambiguous SMTP failure keeps committed state and logs only its stage", async () => {
  const calls: string[] = [];
  const failures: EmailVerificationResendFailure[] = [];
  await processEmailVerificationResend(
    "kupac@example.com",
    processorDependencies(calls, failures, {
      prepareDelivery() {
        calls.push("prepare");
        return async () => {
          calls.push("deliver:failed");
          throw new Error("SMTP timeout after DATA");
        };
      },
    }),
  );

  assert.equal(calls.some((call) => call.startsWith("replace:")), true);
  assert.equal(calls.at(-1), "deliver:failed");
  assert.deepEqual(failures, [{ stage: "DELIVERY" }]);
});

interface LockedUserState {
  id: string;
  email: string;
  emailVerified: Date | null;
  verificationEmailNextAllowedAt: Date | null;
  verificationEmailResendWindowStartedAt: Date | null;
  verificationEmailResendCount: number | null;
}

function commitDatabaseHarness(
  calls: Array<{ operation: string; input?: unknown }>,
  lockedUser: LockedUserState,
  updateCount = 1,
) {
  return {
    async $transaction(
      work: (transaction: {
        $queryRaw(): Promise<LockedUserState[]>;
        user: {
          updateMany(input: unknown): Promise<{ count: number }>;
        };
        emailVerification: {
          deleteMany(input: unknown): Promise<{ count: number }>;
          create(input: unknown): Promise<unknown>;
        };
      }) => Promise<unknown>,
    ) {
      calls.push({ operation: "transaction" });
      return work({
        async $queryRaw() {
          calls.push({ operation: "user:lock" });
          return [lockedUser];
        },
        user: {
          async updateMany(input) {
            calls.push({ operation: "user:updateMany", input });
            return { count: updateCount };
          },
        },
        emailVerification: {
          async deleteMany(input) {
            calls.push({ operation: "emailVerification:deleteMany", input });
            return { count: 1 };
          },
          async create(input) {
            calls.push({ operation: "emailVerification:create", input });
            return {};
          },
        },
      });
    },
  } as unknown as Parameters<typeof commitEmailVerificationResend>[0];
}

function tokenInput(): EmailVerificationResendTokenInput {
  return {
    userId: "user-1",
    expectedEmail: "kupac@example.com",
    legacyPlaintextToken: RAW_TOKEN,
    tokenHash: TOKEN_HASH!,
  };
}

test("atomic resend increments the fixed allowance and preserves unexpired siblings", async () => {
  const calls: Array<{ operation: string; input?: unknown }> = [];
  const issuedAt = new Date("2026-08-30T12:00:00.000Z");
  const windowStartedAt = new Date("2026-08-30T10:00:00.000Z");
  const database = commitDatabaseHarness(calls, {
    id: "user-1",
    email: "kupac@example.com",
    emailVerified: null,
    verificationEmailNextAllowedAt: issuedAt,
    verificationEmailResendWindowStartedAt: windowStartedAt,
    verificationEmailResendCount:
      EMAIL_VERIFICATION_RESEND_MAX_EMAILS_PER_WINDOW - 1,
  });

  const replaced = await commitEmailVerificationResend(
    database,
    tokenInput(),
    () => {
      calls.push({ operation: "now" });
      return issuedAt;
    },
  );

  assert.equal(replaced, true);
  assert.deepEqual(calls.map(({ operation }) => operation), [
    "transaction",
    "user:lock",
    "now",
    "user:updateMany",
    "emailVerification:deleteMany",
    "emailVerification:create",
  ]);
  assert.deepEqual(
    calls.find(({ operation }) => operation === "user:updateMany")?.input,
    {
      where: {
        id: "user-1",
        email: "kupac@example.com",
        emailVerified: null,
      },
      data: {
        verificationEmailNextAllowedAt: new Date(
          issuedAt.getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
        ),
      verificationEmailResendWindowStartedAt: windowStartedAt,
      verificationEmailResendCount:
        EMAIL_VERIFICATION_RESEND_MAX_EMAILS_PER_WINDOW,
      },
    },
  );
  assert.deepEqual(calls[4]?.input, {
    where: {
      userId: "user-1",
      expires: { lte: issuedAt },
    },
  });
  assert.deepEqual(calls[5]?.input, {
    data: {
      userId: "user-1",
      token: RAW_TOKEN,
      tokenHash: TOKEN_HASH,
      expires: new Date(
        issuedAt.getTime() +
          EMAIL_VERIFICATION_RESEND_TOKEN_LIFETIME_MS,
      ),
    },
  });
});

test("an expired fixed window resets atomically for the newly issued message", async () => {
  const calls: Array<{ operation: string; input?: unknown }> = [];
  const issuedAt = new Date("2026-08-30T12:00:00.000Z");
  const database = commitDatabaseHarness(calls, {
    id: "user-1",
    email: "kupac@example.com",
    emailVerified: null,
    verificationEmailNextAllowedAt: null,
    verificationEmailResendWindowStartedAt: new Date(
      issuedAt.getTime() - EMAIL_VERIFICATION_RESEND_WINDOW_MS,
    ),
    verificationEmailResendCount:
      EMAIL_VERIFICATION_RESEND_MAX_EMAILS_PER_WINDOW,
  });

  const replaced = await commitEmailVerificationResend(
    database,
    tokenInput(),
    () => issuedAt,
  );

  assert.equal(replaced, true);
  assert.deepEqual(
    calls.find(({ operation }) => operation === "user:updateMany")?.input,
    {
      where: {
        id: "user-1",
        email: "kupac@example.com",
        emailVerified: null,
      },
      data: {
        verificationEmailNextAllowedAt: new Date(
          issuedAt.getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
        ),
        verificationEmailResendWindowStartedAt: issuedAt,
        verificationEmailResendCount: 1,
      },
    },
  );
});

test("active cooldown and exhausted daily allowance stop before token mutation", async () => {
  const issuedAt = new Date("2026-08-30T12:00:00.000Z");
  const windowStartedAt = new Date("2026-08-30T10:00:00.000Z");
  const states: LockedUserState[] = [
    {
      id: "user-1",
      email: "kupac@example.com",
      emailVerified: null,
      verificationEmailNextAllowedAt: new Date(issuedAt.getTime() + 1),
      verificationEmailResendWindowStartedAt: windowStartedAt,
      verificationEmailResendCount: 1,
    },
    {
      id: "user-1",
      email: "kupac@example.com",
      emailVerified: null,
      verificationEmailNextAllowedAt: null,
      verificationEmailResendWindowStartedAt: windowStartedAt,
      verificationEmailResendCount:
        EMAIL_VERIFICATION_RESEND_MAX_EMAILS_PER_WINDOW,
    },
  ];

  for (const state of states) {
    const calls: Array<{ operation: string; input?: unknown }> = [];
    const replaced = await commitEmailVerificationResend(
      commitDatabaseHarness(calls, state),
      tokenInput(),
      () => {
        calls.push({ operation: "now" });
        return issuedAt;
      },
    );

    assert.equal(replaced, false);
    assert.deepEqual(calls.map(({ operation }) => operation), [
      "transaction",
      "user:lock",
      "now",
    ]);
  }
});

test("legacy null throttle state starts a counted window", async () => {
  const calls: Array<{ operation: string; input?: unknown }> = [];
  const issuedAt = new Date("2026-08-30T12:00:00.000Z");
  const database = commitDatabaseHarness(calls, {
    id: "user-1",
    email: "kupac@example.com",
    emailVerified: null,
    verificationEmailNextAllowedAt: null,
    verificationEmailResendWindowStartedAt: null,
    verificationEmailResendCount: null,
  });

  assert.equal(
    await commitEmailVerificationResend(
      database,
      tokenInput(),
      () => issuedAt,
    ),
    true,
  );
  assert.deepEqual(
    calls.find(({ operation }) => operation === "user:updateMany")?.input,
    {
      where: {
        id: "user-1",
        email: "kupac@example.com",
        emailVerified: null,
      },
      data: {
        verificationEmailNextAllowedAt: new Date(
          issuedAt.getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
        ),
        verificationEmailResendWindowStartedAt: issuedAt,
        verificationEmailResendCount: 1,
      },
    },
  );
});
