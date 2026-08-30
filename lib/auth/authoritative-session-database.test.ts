import assert from "node:assert/strict";
import test from "node:test";
import {
  createAuthoritativeSessionDatabase,
  type InsertLockedAuthoritativeSessionInput,
} from "./authoritative-session-database";
import {
  createAuthSessionClaimsV2,
  generateAuthSessionSid,
} from "./session-claims";

const SESSION_SECRET = "s".repeat(32);
const ISSUED_AT = new Date("2026-08-30T12:00:00.000Z");
const EXPIRES_AT = new Date("2026-08-30T13:00:00.000Z");
const SID = generateAuthSessionSid();

function createClaims(overrides: Record<string, unknown> = {}) {
  return {
    ...createAuthSessionClaimsV2({
      sub: "user-1",
      sid: SID,
      ur: 4,
      pr: 7,
      issuedAt: ISSUED_AT,
      absoluteExpiresAt: EXPIRES_AT,
    }),
    ...overrides,
  };
}

function createRow(overrides: Record<string, unknown> = {}) {
  return {
    sessionUserId: "user-1",
    sessionUserRevision: 4,
    sessionPolicyRevision: 7,
    sessionIssuedAt: ISSUED_AT,
    sessionExpires: EXPIRES_AT,
    userId: "user-1",
    email: "kupac@example.invalid",
    firstName: "Petar",
    lastName: "Petrović",
    role: "CUSTOMER",
    createdAt: new Date("2026-08-01T12:00:00.000Z"),
    emailVerified: null,
    emailVerificationLoginGraceUntil: null,
    userRevision: 4,
    policyId: 1,
    policyRevision: 7,
    policy: "audit",
    stagedGraceDeadline: null,
    policyCreatedAt: new Date("2026-08-01T12:00:00.000Z"),
    policyUpdatedAt: new Date("2026-08-01T12:00:00.000Z"),
    policyCount: BigInt(1),
    evaluatedAt: new Date("2026-08-30T12:30:00.000Z"),
    ...overrides,
  };
}

function createFakePrisma(
  rows: unknown[] = [createRow()],
  options: { queryError?: boolean; deleteCount?: number } = {},
) {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const deletes: unknown[] = [];
  const inserts: unknown[] = [];
  const fake = {
    async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      queries.push({ sql: strings.join("?"), values });
      if (options.queryError) throw new Error("database unavailable");
      return rows;
    },
    session: {
      async deleteMany(where: unknown) {
        deletes.push(where);
        return { count: options.deleteCount ?? 1 };
      },
      async create(value: unknown) {
        inserts.push(value);
        return { id: "session-1" };
      },
    },
  };

  return {
    prisma: fake as never,
    queries,
    deletes,
    inserts,
  };
}

test("authoritative DB validation returns a fresh principal without JWT/SID", async () => {
  const fake = createFakePrisma();
  const database = createAuthoritativeSessionDatabase(fake.prisma, SESSION_SECRET);

  const result = await database.validate(createClaims());

  assert.deepEqual(result, {
    status: "valid",
    principal: {
      id: "user-1",
      email: "kupac@example.invalid",
      firstName: "Petar",
      lastName: "Petrović",
      name: "Petar Petrović",
      role: "CUSTOMER",
      requiresEmailVerification: true,
    },
  });
  assert.equal(fake.queries.length, 1);
  assert.match(
    fake.queries[0]?.sql ?? "",
    /clock_timestamp\(\) AT TIME ZONE 'UTC'/,
  );
  assert.match(fake.queries[0]?.sql ?? "", /public\."Session"/);
  assert.match(fake.queries[0]?.sql ?? "", /public\."User"/);
  assert.match(fake.queries[0]?.sql ?? "", /public\."AuthPolicyState"/);
  assert.equal(fake.queries[0]?.values.length, 1);
  assert.match(String(fake.queries[0]?.values[0]), /^v1:[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(result).includes("sid"), false);
  assert.equal(JSON.stringify(result).includes("aaaaaaaa"), false);
});

test("malformed unknown claims are invalid before a database query", async () => {
  const fake = createFakePrisma();
  const database = createAuthoritativeSessionDatabase(fake.prisma, SESSION_SECRET);

  assert.deepEqual(await database.validate({ sub: "user-1" }), {
    status: "invalid",
  });
  assert.deepEqual(await database.validate({ ...createClaims(), extra: true }), {
    status: "invalid",
  });
  assert.equal(fake.queries.length, 0);
});

test("session/user/policy revisions and exact timestamps are all authoritative", async () => {
  for (const row of [
    createRow({ sessionUserRevision: 5 }),
    createRow({ userRevision: 5 }),
    createRow({ policyRevision: 8 }),
    createRow({ sessionIssuedAt: new Date("2026-08-30T12:00:01.000Z") }),
    createRow({ sessionExpires: new Date("2026-08-30T13:00:01.000Z") }),
  ]) {
    const fake = createFakePrisma([row]);
    const database = createAuthoritativeSessionDatabase(fake.prisma, SESSION_SECRET);
    assert.deepEqual(await database.validate(createClaims()), { status: "invalid" });
  }
});

test("missing sessions and expiry are invalid, but invalid policy state is unavailable", async () => {
  const cases: Array<{ row: Record<string, unknown>; expected: string }> = [
    { row: createRow({ sessionUserId: null }), expected: "invalid" },
    { row: createRow({ userId: null }), expected: "invalid" },
    {
      row: createRow({ evaluatedAt: new Date("2026-08-30T13:00:00.000Z") }),
      expected: "invalid",
    },
    { row: createRow({ policyId: null }), expected: "unavailable" },
    { row: createRow({ policyCount: BigInt(2) }), expected: "unavailable" },
    { row: createRow({ policy: "unsafe" }), expected: "unavailable" },
    {
      row: createRow({ policy: "staged", stagedGraceDeadline: null }),
      expected: "unavailable",
    },
  ];

  for (const { row, expected } of cases) {
    const fake = createFakePrisma([row]);
    const database = createAuthoritativeSessionDatabase(fake.prisma, SESSION_SECRET);
    assert.deepEqual(await database.validate(createClaims()), { status: expected });
  }
});

test("fresh DB role and profile replace any stale JWT projection", async () => {
  const fake = createFakePrisma([
    createRow({
      firstName: "Sveža",
      lastName: "Uloga",
      role: "OPERATOR",
    }),
  ]);
  const database = createAuthoritativeSessionDatabase(fake.prisma, SESSION_SECRET);

  const result = await database.validate({
    ...createClaims(),
  });

  assert.deepEqual(result, {
    status: "valid",
    principal: {
      id: "user-1",
      email: "kupac@example.invalid",
      firstName: "Sveža",
      lastName: "Uloga",
      name: "Sveža Uloga",
      role: "OPERATOR",
      requiresEmailVerification: true,
    },
  });
});

test("current strict policy denial invalidates an otherwise matching session", async () => {
  const fake = createFakePrisma([
    createRow({
      policy: "strict",
      stagedGraceDeadline: null,
    }),
  ]);
  const database = createAuthoritativeSessionDatabase(fake.prisma, SESSION_SECRET);

  assert.deepEqual(await database.validate(createClaims()), { status: "invalid" });
});

test("DB singleton policy and deadline alone control the staged decision", async () => {
  const stagedDeadline = new Date("2026-08-30T13:00:00.000Z");
  const fake = createFakePrisma([
    createRow({
      policy: "staged",
      stagedGraceDeadline: stagedDeadline,
      emailVerificationLoginGraceUntil: stagedDeadline,
    }),
  ]);
  const database = createAuthoritativeSessionDatabase(fake.prisma, SESSION_SECRET);

  assert.equal((await database.validate(createClaims())).status, "valid");
});

test("current session revocation is exact and dependency errors remain unavailable", async () => {
  const fake = createFakePrisma();
  const database = createAuthoritativeSessionDatabase(fake.prisma, SESSION_SECRET);

  assert.equal(await database.revokeCurrent(createClaims()), "revoked");
  const deletedWhere = fake.deletes[0] as {
    where: {
      sessionToken: string;
      userId: string;
      authSessionRevision: number;
      authPolicyRevision: number;
      issuedAt: Date;
      expires: Date;
    };
  };
  assert.match(deletedWhere.where.sessionToken, /^v1:[0-9a-f]{64}$/);
  assert.equal(deletedWhere.where.userId, "user-1");
  assert.equal(deletedWhere.where.authSessionRevision, 4);
  assert.equal(deletedWhere.where.authPolicyRevision, 7);
  assert.equal(deletedWhere.where.issuedAt.getTime(), ISSUED_AT.getTime());
  assert.equal(deletedWhere.where.expires.getTime(), EXPIRES_AT.getTime());

  const unavailable = createAuthoritativeSessionDatabase(
    createFakePrisma([], { queryError: true }).prisma,
    SESSION_SECRET,
  );
  assert.deepEqual(await unavailable.validate(createClaims()), {
    status: "unavailable",
  });
  assert.equal(
    await createAuthoritativeSessionDatabase(
      createFakePrisma([], { deleteCount: 0 }).prisma,
      SESSION_SECRET,
    ).revokeCurrent(createClaims()),
    "invalid",
  );
});

test("locked insert rejects non-canonical bounds and persists only a storage digest", async () => {
  const fake = createFakePrisma();
  const database = createAuthoritativeSessionDatabase(fake.prisma, SESSION_SECRET);
  const input: InsertLockedAuthoritativeSessionInput = {
    sid: SID,
    userId: "user-1",
    authSessionRevision: 4,
    authPolicyRevision: 7,
    issuedAt: ISSUED_AT,
    expires: EXPIRES_AT,
  };

  await database.insertLockedSession(fake.prisma, input);
  assert.equal(fake.inserts.length, 1);
  const inserted = fake.inserts[0] as {
    data: { sessionToken: string; issuedAt: Date; expires: Date };
  };
  assert.match(inserted.data.sessionToken, /^v1:[0-9a-f]{64}$/);
  assert.notEqual(inserted.data.sessionToken, input.sid);
  assert.equal(inserted.data.issuedAt, ISSUED_AT);
  assert.equal(inserted.data.expires, EXPIRES_AT);

  await assert.rejects(
    database.insertLockedSession(fake.prisma, {
      ...input,
      expires: new Date("2026-08-31T12:00:01.000Z"),
    }),
    /Invalid locked authoritative session insert input/,
  );

  assert.equal(await database.revokeAllForUser(fake.prisma, "user-1"), 1);
  await assert.rejects(
    database.revokeAllForUser(fake.prisma, ""),
    /Invalid locked authoritative session user id/,
  );
});

test("runtime policy is derived only from the DB singleton and invalid secret fails fast", async () => {
  const fake = createFakePrisma();
  assert.throws(
    () =>
      createAuthoritativeSessionDatabase(fake.prisma, "short"),
    /Session HMAC secret/,
  );
});
