import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import {
  CREDENTIALS_DUMMY_PASSWORD,
  CREDENTIALS_DUMMY_PASSWORD_HASH,
  MAX_BCRYPT_PASSWORD_BYTES,
  isBcryptSafePassword,
  isSupportedBcryptPasswordHash,
  hashPassword,
  validatePassword,
  verifyPassword,
  verifyPasswordConstantWork,
} from "./password";

test("bcrypt input guard measures UTF-8 bytes rather than JavaScript length", () => {
  assert.equal(isBcryptSafePassword(undefined), false);
  assert.equal(isBcryptSafePassword("a".repeat(MAX_BCRYPT_PASSWORD_BYTES)), true);
  assert.equal(
    isBcryptSafePassword("a".repeat(MAX_BCRYPT_PASSWORD_BYTES + 1)),
    false,
  );
  assert.equal(isBcryptSafePassword("š".repeat(36)), true);
  assert.equal(isBcryptSafePassword("š".repeat(37)), false);
});

test("password policy remains independent from the bcrypt byte guard", () => {
  assert.deepEqual(validatePassword("DobraLozinka1!"), {
    valid: true,
    errors: [],
  });
  assert.equal(validatePassword("slaba").valid, false);
  assert.equal(validatePassword(`A1!${"x".repeat(70)}`).valid, false);
});

test("hashPassword rejects bcrypt-truncated input as defense in depth", async () => {
  await assert.rejects(
    hashPassword(`A1!${"x".repeat(70)}`),
    /bcrypt byte limit/,
  );
});

test("verifyPassword rejects a suffix beyond bcrypt's 72-byte boundary", async () => {
  const exactBoundaryPassword = `A1!${"x".repeat(
    MAX_BCRYPT_PASSWORD_BYTES - 3,
  )}`;
  const passwordHash = await hashPassword(exactBoundaryPassword);

  assert.equal(await verifyPassword(exactBoundaryPassword, passwordHash), true);
  assert.equal(
    await verifyPassword(`${exactBoundaryPassword}x`, passwordHash),
    false,
  );
});

test("credential dummy fixture is a real cost-12 bcrypt pair", async () => {
  assert.equal(CREDENTIALS_DUMMY_PASSWORD_HASH.length, 60);
  assert.equal(bcrypt.getRounds(CREDENTIALS_DUMMY_PASSWORD_HASH), 12);
  assert.equal(
    await bcrypt.compare(
      CREDENTIALS_DUMMY_PASSWORD,
      CREDENTIALS_DUMMY_PASSWORD_HASH,
    ),
    true,
  );
});

test("credentials accept only 2a/2b cost-12 hashes used by the dummy path", () => {
  assert.equal(
    isSupportedBcryptPasswordHash(CREDENTIALS_DUMMY_PASSWORD_HASH),
    true,
  );
  for (const cost of ["04", "11", "13", "16", "17"]) {
    assert.equal(
      isSupportedBcryptPasswordHash(
        CREDENTIALS_DUMMY_PASSWORD_HASH.replace("$12$", `$${cost}$`),
      ),
      false,
    );
  }
  assert.equal(
    isSupportedBcryptPasswordHash(
      CREDENTIALS_DUMMY_PASSWORD_HASH.replace("$2a$", "$2y$"),
    ),
    false,
  );
  assert.equal(isSupportedBcryptPasswordHash("nije-bcrypt"), false);
  assert.equal(isSupportedBcryptPasswordHash(undefined), false);
});

test("constant-work verification uses one real comparison for eligible inputs", async () => {
  const calls: Array<{ password: string; hash: string }> = [];
  const result = await verifyPasswordConstantWork(
    "DobraLozinka1!",
    CREDENTIALS_DUMMY_PASSWORD_HASH,
    async (password, hash) => {
      calls.push({ password, hash });
      return true;
    },
  );

  assert.equal(result, true);
  assert.deepEqual(calls, [
    {
      password: "DobraLozinka1!",
      hash: CREDENTIALS_DUMMY_PASSWORD_HASH,
    },
  ]);
});

test("constant-work verification substitutes one dummy comparison for unusable input", async () => {
  for (const [password, hash] of [
    [undefined, CREDENTIALS_DUMMY_PASSWORD_HASH],
    ["", CREDENTIALS_DUMMY_PASSWORD_HASH],
    [`A1!${"š".repeat(36)}`, CREDENTIALS_DUMMY_PASSWORD_HASH],
    ["DobraLozinka1!", null],
    ["DobraLozinka1!", "neispravan-hash"],
    [
      "DobraLozinka1!",
      CREDENTIALS_DUMMY_PASSWORD_HASH.replace("$12$", "$11$"),
    ],
    [
      "DobraLozinka1!",
      CREDENTIALS_DUMMY_PASSWORD_HASH.replace("$12$", "$13$"),
    ],
  ] as const) {
    const calls: Array<{ password: string; hash: string }> = [];
    const result = await verifyPasswordConstantWork(
      password,
      hash,
      async (comparedPassword, comparedHash) => {
        calls.push({ password: comparedPassword, hash: comparedHash });
        return true;
      },
    );

    assert.equal(result, false);
    assert.deepEqual(calls, [
      {
        password: CREDENTIALS_DUMMY_PASSWORD,
        hash: CREDENTIALS_DUMMY_PASSWORD_HASH,
      },
    ]);
  }
});

test("constant-work verification propagates one compare failure to its caller", async () => {
  let comparisons = 0;

  await assert.rejects(
    verifyPasswordConstantWork(
      "DobraLozinka1!",
      CREDENTIALS_DUMMY_PASSWORD_HASH,
      async () => {
        comparisons += 1;
        throw new Error("bcrypt unavailable");
      },
    ),
    /bcrypt unavailable/,
  );
  assert.equal(comparisons, 1);
});
