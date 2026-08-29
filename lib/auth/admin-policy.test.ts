import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminApiAccess,
  getAdminPageAccess,
  isAdminApiPath,
  isAdminPagePath,
} from "./admin-policy";

test("ADMIN can access every admin page and API", () => {
  assert.equal(getAdminPageAccess("ADMIN", "/admin/settings").allowed, true);
  assert.equal(
    getAdminApiAccess("ADMIN", "/api/admin/settings", "DELETE").allowed,
    true
  );
});

test("OPERATOR can only access explicitly allowed admin pages", () => {
  for (const pathname of [
    "/admin/orders",
    "/admin/orders/order-1",
    "/admin/chat/poruke",
  ]) {
    assert.equal(getAdminPageAccess("OPERATOR", pathname).allowed, true);
  }

  for (const pathname of [
    "/admin",
    "/admin/statistics",
    "/admin/products",
    "/admin/chat",
    "/admin/settings",
    "/admin/orders-export",
  ]) {
    assert.deepEqual(getAdminPageAccess("OPERATOR", pathname), {
      allowed: false,
      reason: "OPERATOR_SCOPE",
    });
  }
});

test("OPERATOR API access is constrained by both path and HTTP method", () => {
  assert.equal(
    getAdminApiAccess(
      "OPERATOR",
      "/api/admin/orders/order-1/status",
      "PUT"
    ).allowed,
    true
  );
  assert.equal(
    getAdminApiAccess("OPERATOR", "/api/admin/chat/messages", "GET").allowed,
    true
  );
  assert.equal(
    getAdminApiAccess("OPERATOR", "/api/admin/chat/messages", "put").allowed,
    true
  );

  for (const [pathname, method] of [
    ["/api/admin/orders/order-1/status", "GET"],
    ["/api/admin/orders/order-1", "PUT"],
    ["/api/admin/orders/export", "GET"],
    ["/api/admin/chat/messages", "DELETE"],
    ["/api/admin/products", "GET"],
    ["/api/admin/settings", "GET"],
  ]) {
    assert.deepEqual(getAdminApiAccess("OPERATOR", pathname, method), {
      allowed: false,
      reason: "OPERATOR_SCOPE",
    });
  }
});

test("anonymous and customer access receive distinct denials", () => {
  assert.deepEqual(getAdminPageAccess(undefined, "/admin/orders"), {
    allowed: false,
    reason: "UNAUTHENTICATED",
  });
  assert.deepEqual(getAdminApiAccess("CUSTOMER", "/api/admin/chat/messages", "GET"), {
    allowed: false,
    reason: "NOT_ADMIN_STAFF",
  });
});

test("admin path detection does not accept prefix lookalikes", () => {
  assert.equal(isAdminPagePath("/admin/orders"), true);
  assert.equal(isAdminPagePath("/administrator"), false);
  assert.equal(isAdminApiPath("/api/admin/orders"), true);
  assert.equal(isAdminApiPath("/api/administrator"), false);
});
