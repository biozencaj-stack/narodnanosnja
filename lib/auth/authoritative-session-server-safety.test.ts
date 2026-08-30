import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production authoritative resolver has no legacy or bearer fallback", () => {
  const source = readFileSync(
    new URL("./authoritative-session-server.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /^import "server-only";/m);
  assert.match(source, /from "next\/headers"/);
  assert.match(source, /\.getAll\(\)/);
  assert.match(source, /authSessionV2CookieName\(\)/);
  assert.match(source, /decodeAuthSessionJwt/);
  assert.match(source, /createAuthoritativeSessionDatabase/);
  assert.doesNotMatch(source, /\bgetToken\s*\(/);
  assert.doesNotMatch(source, /\bgetServerSession\s*\(/);
  assert.doesNotMatch(source, /from\s+["']next-auth/);
  assert.doesNotMatch(source, /\.get\(\s*["']authorization["']/i);
  assert.doesNotMatch(source, /authSessionCookieName\(/);
});
