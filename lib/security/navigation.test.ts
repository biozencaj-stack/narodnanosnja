import assert from "node:assert/strict";
import test from "node:test";
import { safeLoginCallbackPath } from "./navigation";

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
