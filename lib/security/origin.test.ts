import assert from "node:assert/strict";
import test from "node:test";
import { isTrustedWriteRequest } from "./origin";

test("accepts a matching HTTPS origin", () => {
  const headers = new Headers({
    host: "shop.example.com",
    origin: "https://shop.example.com",
  });
  assert.equal(isTrustedWriteRequest(headers), true);
});

test("rejects cross-origin and malformed origins", () => {
  assert.equal(
    isTrustedWriteRequest(
      new Headers({
        host: "shop.example.com",
        origin: "https://attacker.example",
      }),
    ),
    false,
  );
  assert.equal(
    isTrustedWriteRequest(
      new Headers({ host: "shop.example.com", origin: "not a URL" }),
    ),
    false,
  );
});

test("only accepts missing Origin with same-origin Fetch Metadata", () => {
  assert.equal(
    isTrustedWriteRequest(
      new Headers({ host: "shop.example.com", "sec-fetch-site": "same-origin" }),
    ),
    true,
  );
  assert.equal(
    isTrustedWriteRequest(new Headers({ host: "shop.example.com" })),
    false,
  );
});
