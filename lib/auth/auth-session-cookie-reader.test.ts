import assert from "node:assert/strict";
import test from "node:test";
import { AUTH_SESSION_COOKIE_BASE_NAMES } from "./config";
import {
  MAX_AUTH_SESSION_COOKIE_CHUNK_LENGTH,
  MAX_AUTH_SESSION_COOKIE_CHUNKS,
  MAX_AUTH_SESSION_COOKIE_TOTAL_LENGTH,
  readAuthSessionCookie,
} from "./auth-session-cookie-reader";

const insecureV2Base = AUTH_SESSION_COOKIE_BASE_NAMES[0];
const secureV2Base = AUTH_SESSION_COOKIE_BASE_NAMES[1];

function read(cookies: unknown, base: unknown = insecureV2Base) {
  return readAuthSessionCookie(cookies, base);
}

function assertFrozen(result: ReturnType<typeof read>) {
  assert.equal(Object.isFrozen(result), true);
}

test("reader accepts only the exact selected V2 base and freezes every result", () => {
  const result = read([
    { name: "next-auth.session-token", value: "legacy" },
    { name: secureV2Base, value: "other-v2-mode" },
    { name: "unrelated", value: "ignored" },
    { name: insecureV2Base, value: "expected-jwe" },
  ]);
  assert.deepEqual(result, { status: "present", token: "expected-jwe" });
  assertFrozen(result);
  assertFrozen(read([]));
  assertFrozen(read([{ name: insecureV2Base, value: "" }]));
});

test("reader joins exact contiguous chunks by index, independent of request order", () => {
  const result = read([
    { name: `${insecureV2Base}.2`, value: "third" },
    { name: "next-auth.session-token.0", value: "legacy" },
    { name: `${insecureV2Base}.0`, value: "first" },
    { name: `${insecureV2Base}.1`, value: "second" },
    { name: "unrelated.0", value: "ignored" },
  ]);
  assert.deepEqual(result, { status: "present", token: "firstsecondthird" });
  assertFrozen(result);
});

test("reader rejects base/chunk mixes, duplicates, gaps and noncanonical target suffixes", () => {
  const invalidInputs: unknown[] = [
    [
      { name: insecureV2Base, value: "base" },
      { name: `${insecureV2Base}.0`, value: "chunk" },
    ],
    [
      { name: `${insecureV2Base}.0`, value: "a" },
      { name: `${insecureV2Base}.0`, value: "b" },
    ],
    [
      { name: `${insecureV2Base}.0`, value: "a" },
      { name: `${insecureV2Base}.2`, value: "c" },
    ],
    [{ name: `${insecureV2Base}.00`, value: "a" }],
    [{ name: `${insecureV2Base}.01`, value: "a" }],
    [{ name: `${insecureV2Base}.8`, value: "a" }],
    [{ name: `${insecureV2Base}.1x`, value: "a" }],
    [{ name: `${insecureV2Base}.`, value: "a" }],
    [{ name: `${insecureV2Base}.0.extra`, value: "a" }],
  ];
  for (const input of invalidInputs) {
    assert.deepEqual(read(input), { status: "invalid" });
  }
});

test("reader ignores unrelated malformed cookies but rejects a malformed selected value", () => {
  assert.deepEqual(
    read([null, 42, { name: 1, value: 1 }, { name: "unrelated", value: null }]),
    { status: "missing" },
  );
  for (const value of ["", 42, null, undefined, {}, "x".repeat(4_097)]) {
    assert.deepEqual(
      read([{ name: insecureV2Base, value }]),
      { status: "invalid" },
    );
  }

  const hostileGetter = Object.defineProperty({}, "name", {
    get(): never {
      throw new Error("private getter failure");
    },
  });
  assert.deepEqual(read([hostileGetter]), { status: "invalid" });

  const revokedCookies = Proxy.revocable([], {});
  revokedCookies.revoke();
  assert.deepEqual(read(revokedCookies.proxy), { status: "invalid" });
});

test("reader applies exact chunk and total boundaries", () => {
  const maxChunks = Array.from(
    { length: MAX_AUTH_SESSION_COOKIE_CHUNKS },
    (_, index) => ({ name: `${insecureV2Base}.${index}`, value: "x" }),
  );
  assert.deepEqual(read(maxChunks), {
    status: "present",
    token: "x".repeat(MAX_AUTH_SESSION_COOKIE_CHUNKS),
  });
  assert.deepEqual(
    read([
      {
        name: `${insecureV2Base}.0`,
        value: "x".repeat(MAX_AUTH_SESSION_COOKIE_CHUNK_LENGTH + 1),
      },
    ]),
    { status: "invalid" },
  );
  const atTotalLimit = Array.from(
    { length: MAX_AUTH_SESSION_COOKIE_CHUNKS },
    (_, index) => ({
      name: `${insecureV2Base}.${index}`,
      value: "x".repeat(MAX_AUTH_SESSION_COOKIE_CHUNK_LENGTH),
    }),
  );
  const result = read(atTotalLimit);
  assert.equal(
    result.status === "present" ? result.token.length : undefined,
    MAX_AUTH_SESSION_COOKIE_TOTAL_LENGTH,
  );
});

test("reader rejects hostile target suffixes and invalid active bases", () => {
  const hugeSuffix = "9".repeat(100_000);
  assert.deepEqual(
    read([{ name: `${insecureV2Base}.${hugeSuffix}`, value: "x" }]),
    { status: "invalid" },
  );
  assert.deepEqual(
    read([{ name: `${insecureV2Base}-lookalike.0`, value: "x" }]),
    { status: "missing" },
  );
  assert.deepEqual(
    read([{ name: insecureV2Base, value: "x" }], "next-auth.session-token"),
    { status: "invalid" },
  );
  assert.deepEqual(
    read([{ name: insecureV2Base, value: "x" }], "not-a-configured-base"),
    { status: "invalid" },
  );
});
