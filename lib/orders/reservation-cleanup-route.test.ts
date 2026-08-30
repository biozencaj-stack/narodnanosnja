import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import {
  orderReservationCleanupHttpResult,
  POST,
  readOrderReservationCleanupApplyFlag,
} from "../../app/api/cron/order-reservations/route";

const ENDPOINT = "https://shop.example.com/api/cron/order-reservations";
const SECRET = "0123456789abcdef0123456789abcdef";

function request(body?: string, authorization?: string): NextRequest {
  return new NextRequest(ENDPOINT, {
    method: "POST",
    headers: {
      ...(authorization ? { authorization } : {}),
      "content-type": "application/json",
      origin: "https://shop.example.com",
    },
    ...(body === undefined ? {} : { body }),
  });
}

test("cleanup request defaults to dry-run and requires an explicit boolean apply", async () => {
  assert.equal(
    await readOrderReservationCleanupApplyFlag(request(undefined)),
    false,
  );
  assert.equal(await readOrderReservationCleanupApplyFlag(request("{}")), false);
  assert.equal(
    await readOrderReservationCleanupApplyFlag(request('{"apply":false}')),
    false,
  );
  assert.equal(
    await readOrderReservationCleanupApplyFlag(request('{"apply":true}')),
    true,
  );

  await assert.rejects(
    readOrderReservationCleanupApplyFlag(request('{"apply":"true"}')),
    /INVALID_REQUEST_BODY/,
  );
  await assert.rejects(
    readOrderReservationCleanupApplyFlag(
      request('{"apply":true,"batchSize":200}'),
    ),
    /INVALID_REQUEST_BODY/,
  );
});

test("cleanup route fails closed for server secret and bearer errors", async () => {
  const previousSecret = process.env.ORDER_RESERVATION_CLEANUP_SECRET;
  try {
    delete process.env.ORDER_RESERVATION_CLEANUP_SECRET;
    const unavailable = await POST(request("{}"));
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.headers.get("cache-control"), "no-store, max-age=0");

    process.env.ORDER_RESERVATION_CLEANUP_SECRET = SECRET;
    const unauthorized = await POST(
      request("{}", `Bearer ${"f".repeat(SECRET.length)}`),
    );
    assert.equal(unauthorized.status, 401);
    assert.equal(
      unauthorized.headers.get("www-authenticate"),
      'Bearer realm="order-reservations"',
    );
    assert.equal(
      unauthorized.headers.get("cache-control"),
      "no-store, max-age=0",
    );

    const invalidBody = await POST(
      request('{"apply":1}', `Bearer ${SECRET}`),
    );
    assert.equal(invalidBody.status, 400);
    assert.deepEqual(await invalidBody.json(), {
      success: false,
      code: "INVALID_REQUEST_BODY",
    });
  } finally {
    if (previousSecret === undefined) {
      delete process.env.ORDER_RESERVATION_CLEANUP_SECRET;
    } else {
      process.env.ORDER_RESERVATION_CLEANUP_SECRET = previousSecret;
    }
  }
});

test("cleanup route turns every per-order failure into an alerting HTTP failure", () => {
  assert.deepEqual(
    orderReservationCleanupHttpResult({
      scanned: 2,
      expired: 1,
      reviewed: 0,
      skipped: 0,
      failed: 1,
      dryRun: false,
    }),
    {
      status: 500,
      body: {
        success: false,
        code: "ORDER_RESERVATION_CLEANUP_PARTIAL_FAILURE",
        scanned: 2,
        expired: 1,
        reviewed: 0,
        skipped: 0,
        failed: 1,
        dryRun: false,
      },
    },
  );

  assert.deepEqual(
    orderReservationCleanupHttpResult({
      scanned: 1,
      expired: 1,
      reviewed: 0,
      skipped: 0,
      failed: 0,
      dryRun: true,
    }),
    {
      status: 200,
      body: {
        success: true,
        scanned: 1,
        expired: 1,
        reviewed: 0,
        skipped: 0,
        failed: 0,
        dryRun: true,
      },
    },
  );
});
