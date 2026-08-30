import assert from "node:assert/strict";
import test from "node:test";
import { hashCredentialToken } from "./credential-token";
import {
  REGISTRATION_VERIFICATION_COOLDOWN_MS,
  REGISTRATION_VERIFICATION_INITIAL_EMAIL_COUNT,
  REGISTRATION_VERIFICATION_TOKEN_LIFETIME_MS,
  registerAccount,
  type RegistrationDatabase,
  type RegistrationTransaction,
  type RegistrationUserWrite,
  type RegistrationVerificationWrite,
} from "./registration";

const ISSUED_AT = new Date("2026-08-30T14:00:00.000Z");
const RAW_TOKEN = "a".repeat(64);
const TOKEN_HASH = hashCredentialToken("email-verification", RAW_TOKEN);
if (!TOKEN_HASH) throw new Error("Test token must produce a hash");
const INPUT = {
  normalizedEmail: "kupac@example.com",
  passwordHash: "bcrypt-hash",
  firstName: "Kupac",
  lastName: "Test",
  phone: "+381 60 123 456",
  legacyPlaintextToken: RAW_TOKEN,
  tokenHash: TOKEN_HASH,
  issuedAt: ISSUED_AT,
};

function createHarness() {
  const events: string[] = [];
  const userWrites: RegistrationUserWrite[] = [];
  const verificationWrites: RegistrationVerificationWrite[] = [];
  const transaction: RegistrationTransaction = {
    async createUser(input) {
      events.push("create-user");
      userWrites.push(input);
      return { id: "new-user-id" };
    },
    async createEmailVerification(input) {
      events.push("create-verification");
      verificationWrites.push(input);
    },
  };
  const database: RegistrationDatabase = {
    async transaction(work) {
      events.push("transaction:start");
      const result = await work(transaction);
      events.push("transaction:commit");
      return result;
    },
    async findUserByEmail(email) {
      events.push(`lookup:${email}`);
      return null;
    },
  };

  return { database, transaction, events, userWrites, verificationWrites };
}

test("registration atomically creates user, initial quota and compatible token", async () => {
  const harness = createHarness();

  const result = await registerAccount(INPUT, harness.database);

  assert.deepEqual(result, { kind: "created" });
  assert.deepEqual(harness.events, [
    "transaction:start",
    "create-user",
    "create-verification",
    "transaction:commit",
  ]);
  assert.deepEqual(harness.userWrites, [
    {
      email: INPUT.normalizedEmail,
      passwordHash: INPUT.passwordHash,
      firstName: INPUT.firstName,
      lastName: INPUT.lastName,
      phone: INPUT.phone,
      verificationEmailNextAllowedAt: new Date(
        ISSUED_AT.getTime() + REGISTRATION_VERIFICATION_COOLDOWN_MS,
      ),
      verificationEmailResendWindowStartedAt: new Date(ISSUED_AT),
      verificationEmailResendCount:
        REGISTRATION_VERIFICATION_INITIAL_EMAIL_COUNT,
    },
  ]);
  assert.deepEqual(harness.verificationWrites, [
    {
      userId: "new-user-id",
      legacyPlaintextToken: INPUT.legacyPlaintextToken,
      tokenHash: INPUT.tokenHash,
      expires: new Date(
        ISSUED_AT.getTime() + REGISTRATION_VERIFICATION_TOKEN_LIFETIME_MS,
      ),
    },
  ]);
});

test("a concurrent duplicate email becomes a generic existing result", async () => {
  const harness = createHarness();
  const uniqueFailure = Object.assign(new Error("private duplicate detail"), {
    code: "P2002",
  });
  harness.database.transaction = async () => {
    throw uniqueFailure;
  };
  harness.database.findUserByEmail = async (email) => {
    harness.events.push(`lookup:${email}`);
    return { id: "winner-id" };
  };

  const result = await registerAccount(INPUT, harness.database);

  assert.deepEqual(result, { kind: "existing" });
  assert.deepEqual(harness.events, [`lookup:${INPUT.normalizedEmail}`]);
});

test("a token/hash unique collision is never mistaken for an existing email", async () => {
  const harness = createHarness();
  const collision = Object.assign(new Error("token collision"), {
    code: "P2002",
  });
  harness.database.transaction = async () => {
    throw collision;
  };

  await assert.rejects(
    registerAccount(INPUT, harness.database),
    (error) => error === collision,
  );
  assert.deepEqual(harness.events, [`lookup:${INPUT.normalizedEmail}`]);
});

test("non-unique failures are not classified as existing", async () => {
  const databaseFailure = new Error("database unavailable");
  const harness = createHarness();
  harness.database.transaction = async () => {
    throw databaseFailure;
  };

  await assert.rejects(
    registerAccount(INPUT, harness.database),
    (error) => error === databaseFailure,
  );
  assert.deepEqual(harness.events, []);

});

test("malformed prepared input fails closed before a transaction", async () => {
  const invalidInputs = [
    { ...INPUT, normalizedEmail: " KUPAC@example.com " },
    { ...INPUT, passwordHash: "" },
    { ...INPUT, firstName: "" },
    { ...INPUT, legacyPlaintextToken: "not-a-token" },
    { ...INPUT, tokenHash: `v1:${"c".repeat(64)}` },
    { ...INPUT, issuedAt: new Date(Number.NaN) },
  ];

  for (const input of invalidInputs) {
    const harness = createHarness();
    await assert.rejects(
      registerAccount(input, harness.database),
      /Invalid prepared registration input/,
    );
    assert.deepEqual(harness.events, []);
  }
});
