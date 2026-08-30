import assert from "node:assert/strict";
import test from "node:test";
import type { AuthoritativeSessionPrincipal } from "./authoritative-session-database";
import type { AuthoritativeSessionResolution } from "./authoritative-session-guard";
import {
  getAdminApiSessionAccess,
  getAdminPageSessionAccess,
  getCustomerApiSessionAccess,
} from "./authoritative-session-access";

type AuthenticatedResolution = Extract<
  AuthoritativeSessionResolution,
  { status: "authenticated" }
>;

function authenticated(
  role: AuthoritativeSessionPrincipal["role"],
): AuthenticatedResolution {
  return Object.freeze({
    status: "authenticated" as const,
    principal: {
      id: `user-${role.toLowerCase()}`,
      email: `${role.toLowerCase()}@example.test`,
      firstName: "Fresh",
      lastName: "Principal",
      name: "Fresh Principal",
      role,
      requiresEmailVerification: false,
    },
  });
}

test("customer access forwards the exact fresh principal in a frozen success result", () => {
  const resolution = authenticated("CUSTOMER");
  const access = getCustomerApiSessionAccess(resolution);

  assert.equal(access.status, "ok");
  if (access.status === "ok") {
    assert.equal(access.principal, resolution.principal);
  }
  assert.equal(Object.isFrozen(access), true);
});

test("admin API applies the existing ADMIN and OPERATOR allowlist to fresh roles", () => {
  const admin = getAdminApiSessionAccess(
    authenticated("ADMIN"),
    "/api/admin/settings",
    "DELETE",
  );
  assert.deepEqual(admin.status, "ok");
  if (admin.status === "ok") assert.equal(admin.role, "ADMIN");

  const allowedOperator = getAdminApiSessionAccess(
    authenticated("OPERATOR"),
    "/api/admin/orders/order-1/status",
    "PUT",
  );
  assert.deepEqual(allowedOperator.status, "ok");
  if (allowedOperator.status === "ok") {
    assert.equal(allowedOperator.role, "OPERATOR");
  }

  const scopedOperator = getAdminApiSessionAccess(
    authenticated("OPERATOR"),
    "/api/admin/settings",
    "GET",
  );
  assert.deepEqual(scopedOperator, {
    status: "forbidden",
    reason: "OPERATOR_SCOPE",
  });

  const customer = getAdminApiSessionAccess(
    authenticated("CUSTOMER"),
    "/api/admin/settings",
    "GET",
  );
  assert.deepEqual(customer, {
    status: "forbidden",
    reason: "NOT_ADMIN_STAFF",
  });
});

test("admin page applies the same fresh-principal role policy", () => {
  assert.deepEqual(
    getAdminPageSessionAccess(authenticated("OPERATOR"), "/admin/orders"),
    {
      status: "ok",
      principal: authenticated("OPERATOR").principal,
      role: "OPERATOR",
    },
  );
  assert.deepEqual(
    getAdminPageSessionAccess(authenticated("OPERATOR"), "/admin/settings"),
    { status: "forbidden", reason: "OPERATOR_SCOPE" },
  );
});

test("missing and invalid resolutions remain unauthenticated without role-policy remapping", () => {
  for (const reason of ["missing", "invalid"] as const) {
    const resolution: AuthoritativeSessionResolution = Object.freeze({
      status: "anonymous" as const,
      reason,
    });
    assert.deepEqual(getCustomerApiSessionAccess(resolution), {
      status: "unauthenticated",
      reason,
    });
    assert.deepEqual(
      getAdminApiSessionAccess(resolution, "/api/admin/settings", "GET"),
      { status: "unauthenticated", reason },
    );
    assert.deepEqual(getAdminPageSessionAccess(resolution, "/admin/settings"), {
      status: "unauthenticated",
      reason,
    });
  }
});

test("unavailable always remains unavailable and every public result is frozen", () => {
  const resolution: AuthoritativeSessionResolution = Object.freeze({
    status: "unavailable" as const,
  });
  for (const access of [
    getCustomerApiSessionAccess(resolution),
    getAdminApiSessionAccess(resolution, "/api/admin/settings", "GET"),
    getAdminPageSessionAccess(resolution, "/admin/settings"),
  ]) {
    assert.deepEqual(access, { status: "unavailable" });
    assert.equal(Object.isFrozen(access), true);
  }
});
