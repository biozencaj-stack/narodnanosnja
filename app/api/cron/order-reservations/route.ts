import { NextRequest, NextResponse } from "next/server";

import {
  runOrderReservationCleanup,
  type OrderReservationCleanupSummary,
} from "@/lib/orders/reservation-cleanup";
import { isValidBearerAuthorization } from "@/lib/security/bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BODY_BYTES = 256;
const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS });
}

function hasValidConfiguredSecret(secret: string | undefined): secret is string {
  return Boolean(
    secret && isValidBearerAuthorization(`Bearer ${secret}`, secret),
  );
}

export function orderReservationCleanupHttpResult(
  result: OrderReservationCleanupSummary,
) {
  if (result.failed > 0) {
    return {
      status: 500,
      body: {
        success: false,
        code: "ORDER_RESERVATION_CLEANUP_PARTIAL_FAILURE",
        ...result,
      },
    };
  }

  return { status: 200, body: { success: true, ...result } };
}

export async function readOrderReservationCleanupApplyFlag(
  request: NextRequest,
): Promise<boolean> {
  const rawBody = await request.text();
  if (!rawBody) return false;
  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BODY_BYTES) {
    throw new Error("REQUEST_BODY_TOO_LARGE");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new Error("INVALID_JSON_BODY");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("INVALID_REQUEST_BODY");
  }

  const record = body as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => key !== "apply") ||
    (record.apply !== undefined && typeof record.apply !== "boolean")
  ) {
    throw new Error("INVALID_REQUEST_BODY");
  }
  return record.apply === true;
}

/**
 * VPS scheduler endpoint. Missing `apply` is deliberately a dry run; a state
 * change therefore requires both the bearer secret and an explicit opt-in.
 */
export async function POST(request: NextRequest) {
  const configuredSecret = process.env.ORDER_RESERVATION_CLEANUP_SECRET;
  if (!hasValidConfiguredSecret(configuredSecret)) {
    return json(
      {
        success: false,
        code: "ORDER_RESERVATION_CLEANUP_NOT_CONFIGURED",
      },
      503,
    );
  }

  if (
    !isValidBearerAuthorization(
      request.headers.get("authorization"),
      configuredSecret,
    )
  ) {
    return NextResponse.json(
      { success: false, code: "UNAUTHORIZED" },
      {
        status: 401,
        headers: {
          ...RESPONSE_HEADERS,
          "WWW-Authenticate": 'Bearer realm="order-reservations"',
        },
      },
    );
  }

  let apply: boolean;
  try {
    apply = await readOrderReservationCleanupApplyFlag(request);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_REQUEST_BODY";
    return json(
      { success: false, code },
      code === "REQUEST_BODY_TOO_LARGE" ? 413 : 400,
    );
  }

  try {
    const result = await runOrderReservationCleanup({ dryRun: !apply });
    const response = orderReservationCleanupHttpResult(result);
    return json(response.body, response.status);
  } catch (error) {
    console.error(
      "[Order reservation cleanup] Fatal error:",
      error instanceof Error ? error.name : "UNKNOWN_ERROR",
    );
    return json(
      { success: false, code: "ORDER_RESERVATION_CLEANUP_FAILED" },
      500,
    );
  }
}
