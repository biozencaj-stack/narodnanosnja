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

test("sekcije stranica su ADMIN-only na svakoj novoj putanji", () => {
  // Politika je deny-by-default, pa nove rute ne traže izmenu pravila. Ovaj
  // test to i dokazuje: da neko ikad doda `/admin/sekcije` u OPERATOR spisak
  // „da bi mogli da menjaju sadržaj”, ovde puca.
  const apiPutanje: readonly (readonly [string, string])[] = [
    ["/api/admin/sekcije", "GET"],
    ["/api/admin/sekcije", "POST"],
    ["/api/admin/sekcije/section-1", "PUT"],
    ["/api/admin/sekcije/section-1", "DELETE"],
    ["/api/admin/sekcije/redosled", "POST"],
    ["/api/admin/sekcije/objavi", "POST"],
    ["/api/admin/medijateka", "GET"],
    ["/api/admin/medijateka/asset-1", "DELETE"],
  ];

  for (const [pathname, method] of apiPutanje) {
    assert.deepEqual(
      getAdminApiAccess("ADMIN", pathname, method),
      { allowed: true, role: "ADMIN" },
      `${method} ${pathname}`,
    );
    assert.deepEqual(
      getAdminApiAccess("OPERATOR", pathname, method),
      { allowed: false, reason: "OPERATOR_SCOPE" },
      `${method} ${pathname}`,
    );
    assert.deepEqual(
      getAdminApiAccess("CUSTOMER", pathname, method),
      { allowed: false, reason: "NOT_ADMIN_STAFF" },
      `${method} ${pathname}`,
    );
    assert.deepEqual(
      getAdminApiAccess(undefined, pathname, method),
      { allowed: false, reason: "UNAUTHENTICATED" },
      `${method} ${pathname}`,
    );
    assert.equal(isAdminApiPath(pathname), true, pathname);
  }

  for (const pathname of [
    "/admin/sekcije",
    "/admin/sekcije/pregled/home",
    "/admin/medijateka",
  ]) {
    assert.deepEqual(getAdminPageAccess("ADMIN", pathname), {
      allowed: true,
      role: "ADMIN",
    });
    assert.deepEqual(getAdminPageAccess("OPERATOR", pathname), {
      allowed: false,
      reason: "OPERATOR_SCOPE",
    });
    assert.deepEqual(getAdminPageAccess(undefined, pathname), {
      allowed: false,
      reason: "UNAUTHENTICATED",
    });
    assert.equal(isAdminPagePath(pathname), true, pathname);
  }
});
