import assert from "node:assert/strict";
import test from "node:test";
import {
  createCredentialTokenLookupKeys,
  type CredentialTokenPurpose,
  generateRawCredentialToken,
  hashCredentialToken,
  isCurrentCredentialTokenHash,
  normalizeRawCredentialToken,
} from "./credential-token";

const RAW_TOKEN = "a".repeat(64);
const UPPERCASE_RAW_TOKEN = "A".repeat(64);

test("generator returns independent 256-bit lowercase hex credentials", () => {
  const generated = Array.from({ length: 32 }, () =>
    generateRawCredentialToken(),
  );

  for (const token of generated) {
    assert.match(token, /^[0-9a-f]{64}$/);
    assert.equal(Buffer.from(token, "hex").byteLength, 32);
  }
  assert.equal(new Set(generated).size, generated.length);
});

test("raw parser accepts exactly 64 hex characters and canonicalizes case", () => {
  assert.equal(normalizeRawCredentialToken(RAW_TOKEN), RAW_TOKEN);
  assert.equal(normalizeRawCredentialToken(UPPERCASE_RAW_TOKEN), RAW_TOKEN);

  for (const invalid of [
    null,
    undefined,
    123,
    {},
    "",
    "a".repeat(63),
    "a".repeat(65),
    ` ${RAW_TOKEN}`,
    `${RAW_TOKEN} `,
    "g".repeat(64),
    `v1:${RAW_TOKEN}`,
  ]) {
    assert.equal(normalizeRawCredentialToken(invalid), null);
  }
});

test("versioned SHA-256 hashes are deterministic and purpose-separated", () => {
  const verificationHash = hashCredentialToken(
    "email-verification",
    RAW_TOKEN,
  );
  const uppercaseVerificationHash = hashCredentialToken(
    "email-verification",
    UPPERCASE_RAW_TOKEN,
  );
  const passwordResetHash = hashCredentialToken("password-reset", RAW_TOKEN);

  assert.equal(
    verificationHash,
    "v1:9330ef059eb572ab2af0b260b99fe487501e07166c93ea6fdc659ae860156da9",
  );
  assert.equal(uppercaseVerificationHash, verificationHash);
  assert.equal(
    passwordResetHash,
    "v1:1bbdaf9e81b05155672e41fe7c65a74064669b0b2bffd68df8992b491ebb22a0",
  );
  assert.notEqual(verificationHash, passwordResetHash);
  assert.equal(verificationHash?.includes(RAW_TOKEN), false);
  assert.equal(passwordResetHash?.includes(RAW_TOKEN), false);
  assert.equal(isCurrentCredentialTokenHash(verificationHash), true);
  assert.equal(isCurrentCredentialTokenHash(passwordResetHash), true);
});

test("stored hash recognizer rejects legacy, uppercase and malformed values", () => {
  const current = hashCredentialToken("email-verification", RAW_TOKEN);
  assert.ok(current);

  for (const invalid of [
    RAW_TOKEN,
    current.toUpperCase(),
    current.slice(0, -1),
    `${current}0`,
    `v2:${current.slice(3)}`,
    null,
    undefined,
  ]) {
    assert.equal(isCurrentCredentialTokenHash(invalid), false);
  }
});

test("lookup keys expose hash-first storage and explicit legacy fallback", () => {
  assert.deepEqual(
    createCredentialTokenLookupKeys("password-reset", UPPERCASE_RAW_TOKEN),
    {
      normalizedRawToken: RAW_TOKEN,
      currentHash:
        "v1:1bbdaf9e81b05155672e41fe7c65a74064669b0b2bffd68df8992b491ebb22a0",
      legacyPlaintext: RAW_TOKEN,
    },
  );
});

test("invalid public input fails without an exception or credential echo", () => {
  const privateInput = ` ${RAW_TOKEN}`;
  const unsupportedPurpose = "unsupported" as CredentialTokenPurpose;

  assert.doesNotThrow(() => {
    assert.equal(hashCredentialToken("email-verification", privateInput), null);
    assert.equal(hashCredentialToken(unsupportedPurpose, RAW_TOKEN), null);
    assert.equal(
      createCredentialTokenLookupKeys("password-reset", privateInput),
      null,
    );
  });
});
