import assert from "node:assert/strict";
import test from "node:test";
import {
  createCredentialsSessionIssuer,
  type CredentialsSessionIssuanceTransaction,
} from "./credentials-session-issuance";
import { CREDENTIALS_DUMMY_PASSWORD_HASH } from "./password";

const SID = "AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA";
const ISSUED_AT = new Date("2026-08-30T12:00:00.000Z");
const CREATED_AT = new Date("2026-08-01T12:00:00.000Z");
const PASSWORD_HASH = CREDENTIALS_DUMMY_PASSWORD_HASH;

function lockedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "kupac@example.com",
    passwordHash: PASSWORD_HASH,
    firstName: "Petar",
    lastName: "Petrović",
    role: "CUSTOMER",
    createdAt: CREATED_AT,
    emailVerified: null,
    emailVerificationLoginGraceUntil: null,
    authSessionRevision: 4,
    ...overrides,
  };
}

function lockedPolicy(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    revision: 7,
    policy: "audit",
    stagedGraceDeadline: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  };
}

function createHarness(options: {
  user?: unknown[];
  policy?: unknown[];
  count?: unknown[];
  clock?: unknown[];
  insertFailure?: boolean;
} = {}) {
  const events: string[] = [];
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const inserts: unknown[] = [];
  const responses = [
    options.user ?? [lockedUser()],
    options.policy ?? [lockedPolicy()],
    options.count ?? [{ policyCount: BigInt(1) }],
    options.clock ?? [{ evaluatedAt: ISSUED_AT, issuedAt: ISSUED_AT }],
  ];
  let responseIndex = 0;

  const transaction: CredentialsSessionIssuanceTransaction = {
    async $queryRaw(strings, ...values) {
      queries.push({ sql: strings.join("?"), values });
      const event = ["lock-user", "lock-policy", "count-policy", "clock"][
        responseIndex
      ];
      events.push(event ?? "unexpected-query");
      const response = responses[responseIndex++];
      return response as never;
    },
  };

  const issuer = createCredentialsSessionIssuer({
    database: {
      async transaction(work) {
        events.push("transaction");
        return work(transaction);
      },
    },
    generateSid: () => {
      events.push("generate-sid");
      return SID;
    },
    async insertLockedSession(_transaction, input) {
      events.push("insert");
      inserts.push(input);
      if (options.insertFailure) throw new Error("injected insert failure");
    },
  });

  return { issuer, events, queries, inserts };
}

const CANDIDATE = {
  id: "user-1",
  email: "kupac@example.com",
  comparedPasswordHash: PASSWORD_HASH,
};

test("credentials V2 issuer locks the exact bcrypt snapshot, policy and UTC clock before one HMAC insert", async () => {
  const harness = createHarness();

  const issued = await harness.issuer.issue(CANDIDATE);

  assert.deepEqual(harness.events, [
    "generate-sid",
    "transaction",
    "lock-user",
    "lock-policy",
    "count-policy",
    "clock",
    "insert",
  ]);
  assert.ok(issued);
  assert.deepEqual(issued.principal, {
    id: "user-1",
    email: "kupac@example.com",
    firstName: "Petar",
    lastName: "Petrović",
    name: "Petar Petrović",
    role: "CUSTOMER",
    requiresEmailVerification: true,
  });
  assert.deepEqual(issued.claims, {
    sv: 2,
    sub: "user-1",
    sid: SID,
    ur: 4,
    pr: 7,
    sat: 1_788_091_200,
    sae: 1_788_177_600,
  });
  assert.equal(issued.claims.sae - issued.claims.sat, 86_400);

  assert.match(harness.queries[0]?.sql ?? "", /FOR UPDATE/);
  assert.match(harness.queries[0]?.sql ?? "", /"passwordHash"/);
  assert.deepEqual(harness.queries[0]?.values, ["user-1"]);
  assert.match(harness.queries[1]?.sql ?? "", /AuthPolicyState/);
  assert.match(harness.queries[1]?.sql ?? "", /FOR SHARE/);
  assert.doesNotMatch(harness.queries[1]?.sql ?? "", /FOR UPDATE/);
  assert.match(harness.queries[2]?.sql ?? "", /count\(\*\)/);
  assert.match(harness.queries[3]?.sql ?? "", /date_trunc\(/);
  assert.match(harness.queries[3]?.sql ?? "", /TIME ZONE 'UTC'/);

  assert.deepEqual(harness.inserts, [
    {
      sid: SID,
      userId: "user-1",
      authSessionRevision: 4,
      authPolicyRevision: 7,
      issuedAt: ISSUED_AT,
      expires: new Date("2026-08-31T12:00:00.000Z"),
    },
  ]);
});

test("credentials V2 issuer rejects a stale id, canonical email or compared password hash before policy/session work", async () => {
  for (const user of [
    lockedUser({ id: "other-user" }),
    lockedUser({ email: "other@example.com" }),
    lockedUser({ passwordHash: "changed-password-hash" }),
  ]) {
    const harness = createHarness({ user: [user] });
    assert.equal(await harness.issuer.issue(CANDIDATE), null);
    assert.deepEqual(harness.events, [
      "generate-sid",
      "transaction",
      "lock-user",
    ]);
    assert.deepEqual(harness.inserts, []);
  }
});

test("credentials V2 issuer uses only strict DB policy and fails closed on denial or malformed singleton", async () => {
  for (const policy of [
    lockedPolicy({ policy: "strict" }),
    lockedPolicy({ revision: 0 }),
    lockedPolicy({ id: 2 }),
  ]) {
    const harness = createHarness({ policy: [policy] });
    assert.equal(await harness.issuer.issue(CANDIDATE), null);
    assert.equal(harness.inserts.length, 0);
  }

  const duplicate = createHarness({ count: [{ policyCount: BigInt(2) }] });
  assert.equal(await duplicate.issuer.issue(CANDIDATE), null);
  assert.equal(duplicate.inserts.length, 0);
});

test("credentials V2 issuer evaluates policy at the precise DB clock while claims stay second-aligned", async () => {
  const harness = createHarness({
    user: [
      lockedUser({
        createdAt: new Date("2026-08-30T12:00:00.250Z"),
        emailVerified: new Date("2026-08-30T12:00:00.900Z"),
      }),
    ],
    policy: [lockedPolicy({ policy: "strict" })],
    clock: [
      {
        evaluatedAt: new Date("2026-08-30T12:00:00.950Z"),
        issuedAt: ISSUED_AT,
      },
    ],
  });

  const issued = await harness.issuer.issue(CANDIDATE);

  assert.ok(issued);
  assert.equal(issued.principal.requiresEmailVerification, false);
  assert.equal(issued.claims.sat, 1_788_091_200);
  assert.equal(issued.claims.sae, 1_788_177_600);
});

test("credentials V2 issuer keeps malformed candidate, revision/clock and insert failures coarse and rollback-safe", async () => {
  const invalidInput = createHarness();
  assert.equal(
    await invalidInput.issuer.issue({
      ...CANDIDATE,
      email: " Kupac@example.com ",
    }),
    null,
  );
  assert.deepEqual(invalidInput.events, []);

  const invalidComparedHash = createHarness();
  assert.equal(
    await invalidComparedHash.issuer.issue({
      ...CANDIDATE,
      comparedPasswordHash: "not-a-supported-bcrypt-hash",
    }),
    null,
  );
  assert.deepEqual(invalidComparedHash.events, []);

  const invalidSid = createHarness();
  assert.equal(await invalidSid.issuer.issue(CANDIDATE, "not-a-sid"), null);
  assert.deepEqual(invalidSid.events, []);

  const invalidRevision = createHarness({
    user: [lockedUser({ authSessionRevision: -1 })],
  });
  assert.equal(await invalidRevision.issuer.issue(CANDIDATE), null);
  assert.equal(invalidRevision.inserts.length, 0);

  const overflowRevision = createHarness({
    user: [lockedUser({ authSessionRevision: 2_147_483_648 })],
  });
  assert.equal(await overflowRevision.issuer.issue(CANDIDATE), null);
  assert.equal(overflowRevision.inserts.length, 0);

  const overflowPolicyRevision = createHarness({
    policy: [lockedPolicy({ revision: 2_147_483_648 })],
  });
  assert.equal(await overflowPolicyRevision.issuer.issue(CANDIDATE), null);
  assert.equal(overflowPolicyRevision.inserts.length, 0);

  const invalidClock = createHarness({
    clock: [
      {
        evaluatedAt: new Date("2026-08-30T12:00:00.500Z"),
        issuedAt: new Date("2026-08-30T12:00:00.500Z"),
      },
    ],
  });
  assert.equal(await invalidClock.issuer.issue(CANDIDATE), null);
  assert.equal(invalidClock.inserts.length, 0);

  const insertFailure = createHarness({ insertFailure: true });
  assert.equal(await insertFailure.issuer.issue(CANDIDATE), null);
  assert.deepEqual(insertFailure.events.slice(-2), ["clock", "insert"]);
});
