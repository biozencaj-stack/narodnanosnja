import assert from "node:assert/strict";
import test from "node:test";
import {
  isSensitiveCredentialPath,
  shouldLoadThirdPartyScripts,
} from "./credential-path";

test("credential routes never load third-party scripts", () => {
  for (const pathname of [
    "/verify-email",
    "/verify-email/verification-token",
    "/reset-password/reset-token",
    "/newsletter/odjava",
  ]) {
    assert.equal(isSensitiveCredentialPath(pathname), true);
    assert.equal(shouldLoadThirdPartyScripts(pathname), false);
  }
});

test("ordinary auth and storefront routes may load third-party scripts", () => {
  for (const pathname of [
    "/verify-email-address",
    "/reset-password",
    "/newsletter",
    "/login",
    "/",
  ]) {
    assert.equal(isSensitiveCredentialPath(pathname), false);
    assert.equal(shouldLoadThirdPartyScripts(pathname), true);
  }
});

test("unresolved routing state is private by default", () => {
  assert.equal(shouldLoadThirdPartyScripts(null), false);
  assert.equal(shouldLoadThirdPartyScripts(undefined), false);
  assert.equal(shouldLoadThirdPartyScripts(""), false);
});
