import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const SHARED_ORDER_ROUTE_EXPORT =
  'export { POST } from "@/lib/checkout/order-handler";\n';

test("both public order endpoints remain exact aliases of the shared handler", () => {
  for (const route of [
    "../../app/api/order/route.ts",
    "../../app/api/orders/route.ts",
  ]) {
    assert.equal(
      readFileSync(new URL(route, import.meta.url), "utf8"),
      SHARED_ORDER_ROUTE_EXPORT,
      route,
    );
  }
});
