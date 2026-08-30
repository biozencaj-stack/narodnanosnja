import assert from "node:assert/strict";
import test from "node:test";
import type { AuthoritativeSessionGuardPrincipal } from "./authoritative-session-guard";
import type { ServerSessionPrincipal } from "./server-session-contract";

type Assert<T extends true> = T;
type ServerAcceptsAuthoritative = Assert<
  AuthoritativeSessionGuardPrincipal extends ServerSessionPrincipal
    ? true
    : false
>;
type AuthoritativeAcceptsServer = Assert<
  ServerSessionPrincipal extends AuthoritativeSessionGuardPrincipal
    ? true
    : false
>;
type ServerHasNoExtraKeys = Assert<
  Exclude<keyof ServerSessionPrincipal, keyof AuthoritativeSessionGuardPrincipal> extends never
    ? true
    : false
>;
type AuthoritativeHasNoExtraKeys = Assert<
  Exclude<keyof AuthoritativeSessionGuardPrincipal, keyof ServerSessionPrincipal> extends never
    ? true
    : false
>;

test("neutral and authoritative principal contracts remain mutually compatible", () => {
  const compileTimeProof: [
    ServerAcceptsAuthoritative,
    AuthoritativeAcceptsServer,
    ServerHasNoExtraKeys,
    AuthoritativeHasNoExtraKeys,
  ] = [true, true, true, true];

  assert.deepEqual(compileTimeProof, [true, true, true, true]);
});
