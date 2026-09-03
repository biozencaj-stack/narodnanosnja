import assert from "node:assert/strict";
import test from "node:test";
import {
  safeExternalUrl,
  safeInternalPath,
  safeLinkTarget,
  safeLoginCallbackPath,
} from "./navigation";

test("accepts canonical internal login callback paths", () => {
  const accepted = [
    ["/", "/"],
    ["/moj-nalog", "/moj-nalog"],
    [
      "/admin/orders?status=PENDING#latest",
      "/admin/orders?status=PENDING#latest",
    ],
    ["/pretraga?q=čarape", "/pretraga?q=%C4%8Darape"],
    ["/čarape", "/%C4%8Darape"],
    ["/%C4%8Darape", "/%C4%8Darape"],
    [
      "/pretraga?q=https%3A%2F%2Fattacker.example%2Fa%5Cb",
      "/pretraga?q=https%3A%2F%2Fattacker.example%2Fa%5Cb",
    ],
    ["/pretraga?q=C:\\vez", "/pretraga?q=C:\\vez"],
  ] as const;

  for (const [value, expected] of accepted) {
    assert.equal(safeLoginCallbackPath(value), expected, value);
  }
});

test("rejects URL schemes and cross-origin callback paths", () => {
  const rejected = [
    null,
    "",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://attacker.example/account",
    "https://internal.invalid/admin",
    "//attacker.example/account",
    "///attacker.example/account",
    "?next=/admin",
    "#admin",
    " /admin",
    "/admin ",
  ];

  for (const value of rejected) {
    assert.equal(safeLoginCallbackPath(value), "/", String(value));
  }
});

test("rejects ambiguous separators, control bytes and dot segments", () => {
  const rejected = [
    "\\attacker.example",
    "/\\attacker.example",
    "/%5cattacker.example",
    "/%2fattacker.example",
    "/%2F%2Fattacker.example",
    "/safe/../admin",
    "/safe/%2e%2e/admin",
    "/safe/.%2e/admin",
    "/./admin",
    "/safe//admin",
    "/\n/attacker.example",
    "/admin\njavascript:alert(1)",
    "/%0d%0aLocation:https://attacker.example",
  ];

  for (const value of rejected) {
    assert.equal(safeLoginCallbackPath(value), "/", value);
  }
});


/* ------------------------------------------------------------------ *
 * Veze koje upisuje administrator (sekcije stranica)
 * ------------------------------------------------------------------ */

test("safeInternalPath accepts canonical paths and bare fragments", () => {
  const accepted: [string, string][] = [
    ["/", "/"],
    ["/catalog", "/catalog"],
    ["/category/salovi", "/category/salovi"],
    ["/catalog?sort=newest", "/catalog?sort=newest"],
    ["#kako-nastaje", "#kako-nastaje"],
    ["#korak_2", "#korak_2"],
  ];

  for (const [value, expected] of accepted) {
    assert.equal(safeInternalPath(value), expected, value);
  }
});

test("safeInternalPath returns null instead of falling back to the home page", () => {
  const rejected = [
    "",
    " /catalog",
    "catalog",
    "//evil.example",
    "/\\evil.example",
    "/%2f%2fevil.example",
    "/a/../../b",
    "javascript:alert(1)",
    "https://evil.example",
    "#",
    "#-korak",
    "# kako nastaje",
    null,
    undefined,
    42,
    {},
  ];

  for (const value of rejected) {
    assert.equal(safeInternalPath(value), null, String(value));
  }
});

test("safeExternalUrl accepts only http and https", () => {
  assert.equal(
    safeExternalUrl("https://primer.rs/stranica"),
    "https://primer.rs/stranica",
  );
  assert.equal(safeExternalUrl("http://primer.rs/"), "http://primer.rs/");

  const rejected = [
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "mailto:neko@primer.rs",
    "tel:+381600000000",
    "ftp://primer.rs",
    " https://primer.rs",
    "/catalog",
    "",
    null,
  ];

  for (const value of rejected) {
    assert.equal(safeExternalUrl(value), null, String(value));
  }
});

test("safeLinkTarget prefers the internal form and rejects unsafe schemes", () => {
  assert.equal(safeLinkTarget("/catalog"), "/catalog");
  assert.equal(safeLinkTarget("#kako-nastaje"), "#kako-nastaje");
  assert.equal(safeLinkTarget("https://primer.rs/"), "https://primer.rs/");
  assert.equal(safeLinkTarget("javascript:alert(1)"), null);
  assert.equal(safeLinkTarget("//evil.example"), null);
});

test("safeLoginCallbackPath keeps its own fallback contract", () => {
  // Ponašanje se NE menja izdvajanjem zajedničke provere: neispravna vrednost
  // i dalje daje "/", a ne null.
  assert.equal(safeLoginCallbackPath("//evil.example"), "/");
  assert.equal(safeLoginCallbackPath("#kako-nastaje"), "/");
  assert.equal(safeLoginCallbackPath("/moj-nalog"), "/moj-nalog");
});
