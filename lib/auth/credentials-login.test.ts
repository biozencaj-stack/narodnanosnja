import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeCredentialsLogin,
  type CredentialsLoginDependencies,
  type CredentialsLoginLookupRecord,
  type CredentialsLoginPolicySnapshot,
  type CredentialsLoginReport,
} from "./credentials-login";
import {
  CREDENTIALS_DUMMY_PASSWORD,
  CREDENTIALS_DUMMY_PASSWORD_HASH,
} from "./password";

const PASSWORD = "DobraLozinka1!";
const LOOKUP: CredentialsLoginLookupRecord = {
  id: "user-1",
  passwordHash: CREDENTIALS_DUMMY_PASSWORD_HASH,
};
const SNAPSHOT: CredentialsLoginPolicySnapshot = {
  id: LOOKUP.id,
  email: "kupac@example.com",
  passwordHash: LOOKUP.passwordHash,
  firstName: "Petar",
  lastName: "Petrović",
  role: "CUSTOMER",
  createdAt: new Date("2026-08-01T12:00:00.000Z"),
  emailVerified: new Date("2026-08-30T15:00:00.000Z"),
  emailVerificationLoginGraceUntil: null,
  evaluatedAt: new Date("2026-08-30T16:00:00.000Z"),
};

function createHarness() {
  const events: string[] = [];
  const comparisons: Array<{ password: unknown; hash: unknown }> = [];
  const reports: CredentialsLoginReport[] = [];
  let lookup: CredentialsLoginLookupRecord | null = LOOKUP;
  let snapshot: CredentialsLoginPolicySnapshot | null = SNAPSHOT;
  let passwordMatches = true;

  const dependencies: CredentialsLoginDependencies = {
    policy: "strict",
    stagedGraceDeadline: null,
    async findCredentialByEmail(email) {
      events.push(`lookup:${email}`);
      return lookup;
    },
    async comparePassword(password, hash) {
      events.push("bcrypt");
      comparisons.push({ password, hash });
      return passwordMatches;
    },
    async readPolicySnapshot(userId) {
      events.push(`snapshot:${userId}`);
      return snapshot;
    },
    report(event) {
      events.push(`report:${event.stage}:${event.reason}`);
      reports.push(event);
    },
  };

  return {
    dependencies,
    events,
    comparisons,
    reports,
    setLookup(value: CredentialsLoginLookupRecord | null) {
      lookup = value;
    },
    setSnapshot(value: CredentialsLoginPolicySnapshot | null) {
      snapshot = value;
    },
    setPasswordMatches(value: boolean) {
      passwordMatches = value;
    },
  };
}

test("credentials normalize email and load policy only after one successful compare", async () => {
  const harness = createHarness();
  const user = await authorizeCredentialsLogin(
    { email: "  KUPAC@EXAMPLE.COM ", password: PASSWORD },
    harness.dependencies,
  );

  assert.deepEqual(harness.events, [
    "lookup:kupac@example.com",
    "bcrypt",
    "snapshot:user-1",
  ]);
  assert.deepEqual(harness.comparisons, [
    { password: PASSWORD, hash: LOOKUP.passwordHash },
  ]);
  assert.deepEqual(user, {
    id: "user-1",
    email: "kupac@example.com",
    name: "Petar Petrović",
    role: "CUSTOMER",
    firstName: "Petar",
    lastName: "Petrović",
    requiresEmailVerification: false,
  });
});

test("syntactically invalid email stops before lookup and bcrypt", async () => {
  const harness = createHarness();

  for (const email of [undefined, "", "nije-email", "Ime <x@example.com>"]) {
    assert.equal(
      await authorizeCredentialsLogin(
        { email, password: PASSWORD },
        harness.dependencies,
      ),
      null,
    );
  }

  assert.deepEqual(harness.events, []);
  assert.deepEqual(harness.comparisons, []);
});

test("unknown account still performs exactly one generic password verification", async () => {
  const harness = createHarness();
  harness.setLookup(null);
  harness.setPasswordMatches(false);

  assert.equal(
    await authorizeCredentialsLogin(
      { email: "kupac@example.com", password: PASSWORD },
      harness.dependencies,
    ),
    null,
  );
  assert.deepEqual(harness.events, ["lookup:kupac@example.com", "bcrypt"]);
  assert.deepEqual(harness.comparisons, [
    {
      password: CREDENTIALS_DUMMY_PASSWORD,
      hash: CREDENTIALS_DUMMY_PASSWORD_HASH,
    },
  ]);
});

test("malformed stored hash uses one dummy pair and never reads policy", async () => {
  const harness = createHarness();
  harness.setLookup({ id: "user-1", passwordHash: "nije-bcrypt" });

  assert.equal(
    await authorizeCredentialsLogin(
      { email: "kupac@example.com", password: PASSWORD },
      harness.dependencies,
    ),
    null,
  );
  assert.deepEqual(harness.events, ["lookup:kupac@example.com", "bcrypt"]);
  assert.deepEqual(harness.comparisons, [
    {
      password: CREDENTIALS_DUMMY_PASSWORD,
      hash: CREDENTIALS_DUMMY_PASSWORD_HASH,
    },
  ]);
});

test("lookup failure performs dummy-eligible compare before a coarse report", async () => {
  const harness = createHarness();
  harness.dependencies.findCredentialByEmail = async () => {
    harness.events.push("lookup");
    throw new Error("private database details");
  };
  harness.setPasswordMatches(false);

  assert.equal(
    await authorizeCredentialsLogin(
      { email: "kupac@example.com", password: PASSWORD },
      harness.dependencies,
    ),
    null,
  );
  assert.deepEqual(harness.comparisons, [
    {
      password: CREDENTIALS_DUMMY_PASSWORD,
      hash: CREDENTIALS_DUMMY_PASSWORD_HASH,
    },
  ]);
  assert.deepEqual(harness.events, [
    "lookup",
    "bcrypt",
    "report:CREDENTIAL_LOOKUP:INTERNAL_FAILURE",
  ]);
  assert.deepEqual(harness.reports, [
    { stage: "CREDENTIAL_LOOKUP", reason: "INTERNAL_FAILURE" },
  ]);
});

test("wrong password never reads verification policy", async () => {
  const harness = createHarness();
  harness.setPasswordMatches(false);

  assert.equal(
    await authorizeCredentialsLogin(
      { email: "kupac@example.com", password: "Pogrešna1!" },
      harness.dependencies,
    ),
    null,
  );
  assert.deepEqual(harness.events, ["lookup:kupac@example.com", "bcrypt"]);
  assert.equal(harness.comparisons.length, 1);
});

test("missing and overlong password still reach the one verifier call", async () => {
  for (const password of [undefined, `A1!${"š".repeat(36)}`]) {
    const harness = createHarness();
    harness.setPasswordMatches(false);

    assert.equal(
      await authorizeCredentialsLogin(
        { email: "kupac@example.com", password },
        harness.dependencies,
      ),
      null,
    );
    assert.deepEqual(harness.events, ["lookup:kupac@example.com", "bcrypt"]);
    assert.deepEqual(harness.comparisons, [
      {
        password: CREDENTIALS_DUMMY_PASSWORD,
        hash: CREDENTIALS_DUMMY_PASSWORD_HASH,
      },
    ]);
  }
});

test("fresh snapshot deletion, password mutation or email mutation denies login", async () => {
  for (const snapshot of [
    null,
    { ...SNAPSHOT, passwordHash: CREDENTIALS_DUMMY_PASSWORD_HASH.replace("Q", "R") },
    { ...SNAPSHOT, email: "drugi@example.com" },
    { ...SNAPSHOT, id: "user-2" },
  ]) {
    const harness = createHarness();
    harness.setSnapshot(snapshot);

    assert.equal(
      await authorizeCredentialsLogin(
        { email: "kupac@example.com", password: PASSWORD },
        harness.dependencies,
      ),
      null,
    );
    assert.deepEqual(harness.events, [
      "lookup:kupac@example.com",
      "bcrypt",
      "snapshot:user-1",
    ]);
  }
});

test("audit allows password-valid unverified user and reports no-PII would-deny", async () => {
  const harness = createHarness();
  harness.dependencies.policy = "audit";
  harness.setSnapshot({ ...SNAPSHOT, emailVerified: null });

  const user = await authorizeCredentialsLogin(
    { email: "kupac@example.com", password: PASSWORD },
    harness.dependencies,
  );

  assert.equal(user?.requiresEmailVerification, true);
  assert.deepEqual(harness.reports, [
    { stage: "POLICY_DECISION", reason: "AUDIT_WOULD_DENY" },
  ]);
  assert.deepEqual(Object.keys(harness.reports[0]).sort(), ["reason", "stage"]);
});

test("staged accepts active customer grace while strict returns generic null", async () => {
  const stagedHarness = createHarness();
  stagedHarness.dependencies.policy = "staged";
  stagedHarness.dependencies.stagedGraceDeadline = new Date(
    "2026-09-29T16:00:00.000Z",
  );
  stagedHarness.setSnapshot({
    ...SNAPSHOT,
    emailVerified: null,
    emailVerificationLoginGraceUntil: new Date(
      "2026-09-29T16:00:00.000Z",
    ),
  });

  const stagedUser = await authorizeCredentialsLogin(
    { email: "kupac@example.com", password: PASSWORD },
    stagedHarness.dependencies,
  );
  assert.equal(stagedUser?.requiresEmailVerification, true);

  const strictHarness = createHarness();
  strictHarness.dependencies.policy = "strict";
  strictHarness.setSnapshot({
    ...SNAPSHOT,
    emailVerified: null,
    emailVerificationLoginGraceUntil: new Date(
      "2027-08-30T16:00:00.000Z",
    ),
  });
  assert.equal(
    await authorizeCredentialsLogin(
      { email: "kupac@example.com", password: PASSWORD },
      strictHarness.dependencies,
    ),
    null,
  );
});

test("invalid fresh policy state is a coarse internal denial even in audit", async () => {
  const invalidSnapshots: CredentialsLoginPolicySnapshot[] = [
    { ...SNAPSHOT, role: "NEPOZNATA" as "CUSTOMER" },
    { ...SNAPSHOT, createdAt: new Date(Number.NaN) },
    { ...SNAPSHOT, evaluatedAt: new Date(Number.NaN) },
    {
      ...SNAPSHOT,
      emailVerified: new Date("2026-07-31T23:59:59.999Z"),
    },
    {
      ...SNAPSHOT,
      emailVerified: new Date("2026-08-30T16:00:00.001Z"),
    },
    { ...SNAPSHOT, emailVerified: new Date(Number.NaN) },
    {
      ...SNAPSHOT,
      emailVerified: null,
      emailVerificationLoginGraceUntil: new Date(Number.NaN),
    },
  ];

  for (const snapshot of invalidSnapshots) {
    const harness = createHarness();
    harness.dependencies.policy = "audit";
    harness.setSnapshot(snapshot);

    assert.equal(
      await authorizeCredentialsLogin(
        { email: "kupac@example.com", password: PASSWORD },
        harness.dependencies,
      ),
      null,
    );
    assert.deepEqual(harness.reports, [
      { stage: "POLICY_DECISION", reason: "INTERNAL_FAILURE" },
    ]);
  }
});

test("dependency failures are generic and a throwing reporter cannot alter denial", async () => {
  const compareFailure = createHarness();
  compareFailure.dependencies.comparePassword = async () => {
    compareFailure.events.push("bcrypt");
    throw new Error("private bcrypt details");
  };
  compareFailure.dependencies.report = () => {
    throw new Error("reporter unavailable");
  };
  assert.equal(
    await authorizeCredentialsLogin(
      { email: "kupac@example.com", password: PASSWORD },
      compareFailure.dependencies,
    ),
    null,
  );

  const snapshotFailure = createHarness();
  snapshotFailure.dependencies.readPolicySnapshot = async () => {
    throw new Error("private database details");
  };
  assert.equal(
    await authorizeCredentialsLogin(
      { email: "kupac@example.com", password: PASSWORD },
      snapshotFailure.dependencies,
    ),
    null,
  );
  assert.deepEqual(snapshotFailure.reports, [
    { stage: "POLICY_SNAPSHOT", reason: "INTERNAL_FAILURE" },
  ]);
});
