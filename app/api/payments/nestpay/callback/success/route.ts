import { NextRequest, NextResponse } from "next/server";
import {
  classifyNestPayCallback,
  createNestPayEventKey,
  sanitizeNestPayCallback,
  verifyCallbackHash,
} from "@/lib/nestpay";
import { PaymentStateError, processPaymentCallback } from "@/lib/orders/payment";
import {
  createOrderAccessCookieValue,
  createOrderAccessToken,
  orderAccessCookieName,
  orderAccessCookieOptions,
} from "@/lib/orders/access";
import { sendOrderConfirmationEmail } from "@/lib/email/order-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Get base URL for redirects (Next.js 15+ doesn't use Host header for req.url)
function getBaseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || req.url;
}

function redirectToOrder(
  req: NextRequest,
  pathname: "/payment/success" | "/payment/failed",
  orderId: string,
  guestAccess: boolean,
  error?: string,
) {
  const url = new URL(pathname, getBaseUrl(req));
  url.searchParams.set("oid", orderId);
  if (error) url.searchParams.set("error", error);
  const response = NextResponse.redirect(url, 303);
  if (guestAccess) {
    const token = createOrderAccessToken(orderId);
    response.cookies.set(
      orderAccessCookieName(orderId),
      createOrderAccessCookieValue(orderId, token),
      orderAccessCookieOptions(),
    );
  }
  return response;
}

export async function POST(req: NextRequest) {
  let hashVerified = false;
  try {
    const formData = await req.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = String(value);
    }

    const oid = params.oid || "";
    if (!oid) {
      return NextResponse.redirect(
        new URL("/payment/failed?error=missing_order_id", getBaseUrl(req)),
        303,
      );
    }

    hashVerified = verifyCallbackHash(params);
    if (!hashVerified) {
      return NextResponse.redirect(
        new URL(
          "/payment/failed?error=hash_verification_failed",
          getBaseUrl(req),
        ),
        303,
      );
    }

    const callback = classifyNestPayCallback(params);
    if (!callback.orderIdSigned) {
      return NextResponse.json(
        { error: "Order identifier is not covered by the provider signature" },
        { status: 400 },
      );
    }
    const result = await processPaymentCallback({
      provider: "NESTPAY",
      orderNumber: oid,
      eventKey: createNestPayEventKey(params),
      outcome: callback.outcome,
      reviewReason: callback.reason,
      transactionId: callback.transactionId,
      authCode: callback.authCode,
      amount: callback.amount,
      currency: callback.currency,
      auditPayload: sanitizeNestPayCallback(params),
    });

    if (result.kind === "REVIEW") {
      console.error(
        `[NestPay] Payment moved to REVIEW: order=${result.orderNumber}, reason=${result.reason}`,
      );
      return redirectToOrder(
        req,
        "/payment/failed",
        result.orderId,
        result.guestAccess,
        "payment_review",
      );
    }

    if (result.callbackOutcome === "APPROVED") {
      if (result.kind === "APPLIED" && result.customerEmail) {
        try {
          await sendOrderConfirmationEmail(result.orderId);
        } catch (emailError) {
          console.error(
            "[NestPay] Payment committed, confirmation email failed:",
            emailError,
          );
        }
      }
      return redirectToOrder(
        req,
        "/payment/success",
        result.orderId,
        result.guestAccess,
      );
    }

    return redirectToOrder(
      req,
      "/payment/failed",
      result.orderId,
      result.guestAccess,
    );
  } catch (error) {
    console.error("[NestPay] Callback processing error:", error);

    if (hashVerified || error instanceof PaymentStateError) {
      return NextResponse.json(
        {
          error: "Rezultat plaćanja je primljen i čeka usaglašavanje.",
          code:
            error instanceof PaymentStateError
              ? error.code
              : "PAYMENT_RECONCILIATION_PENDING",
        },
        { status: 503, headers: { "Retry-After": "30" } },
      );
    }

    return NextResponse.redirect(
      new URL("/payment/failed?error=parse_failed", getBaseUrl(req)),
      303,
    );
  }
}
