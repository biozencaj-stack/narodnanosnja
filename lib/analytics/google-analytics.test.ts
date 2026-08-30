import assert from "node:assert/strict";
import test from "node:test";
import { shouldTrackGoogleAnalyticsPath } from "./google-analytics";

test("credential-bearing paths are excluded from Google Analytics", () => {
  assert.equal(shouldTrackGoogleAnalyticsPath("/verify-email"), false);
  assert.equal(shouldTrackGoogleAnalyticsPath("/verify-email/"), false);
  assert.equal(
    shouldTrackGoogleAnalyticsPath("/verify-email/a-secret-token"),
    false,
  );
  assert.equal(
    shouldTrackGoogleAnalyticsPath("/reset-password/a-secret-token"),
    false,
  );
  assert.equal(shouldTrackGoogleAnalyticsPath("/newsletter/odjava"), false);
});

test("similarly named and normal storefront paths remain trackable", () => {
  assert.equal(shouldTrackGoogleAnalyticsPath("/verify-email-address"), true);
  assert.equal(shouldTrackGoogleAnalyticsPath("/reset-password"), true);
  assert.equal(shouldTrackGoogleAnalyticsPath("/newsletter"), true);
  assert.equal(shouldTrackGoogleAnalyticsPath("/login"), true);
  assert.equal(shouldTrackGoogleAnalyticsPath("/"), true);
});

test("an unresolved pathname is private by default", () => {
  assert.equal(shouldTrackGoogleAnalyticsPath(null), false);
  assert.equal(shouldTrackGoogleAnalyticsPath(undefined), false);
  assert.equal(shouldTrackGoogleAnalyticsPath(""), false);
});
