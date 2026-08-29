import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStorefrontUrl } from "@/lib/config/storefront-url";
import {
  NEWSLETTER_UNSUBSCRIBE_PATH,
  unsubscribeNewsletterWithToken,
  verifyNewsletterUnsubscribeToken,
} from "@/lib/newsletter/unsubscribe";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
} as const;

function jsonNoStore(body: object, status: number) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function redirectNoStore(url: URL) {
  return NextResponse.redirect(url, {
    status: 307,
    headers: NO_STORE_HEADERS,
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoStore(
      { success: false, error: "Nevažeći zahtev za odjavu" },
      400,
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonNoStore(
      { success: false, error: "Nevažeći zahtev za odjavu" },
      400,
    );
  }

  const { email, token } = body as Record<string, unknown>;

  try {
    const authorized = await unsubscribeNewsletterWithToken(
      { email, token },
      async (normalizedEmail) => {
        // updateMany makes a valid request idempotent and avoids revealing
        // whether the address belongs to a user, a guest, both, or neither.
        await prisma.$transaction([
          prisma.user.updateMany({
            where: { email: normalizedEmail, newsletterOptIn: true },
            data: { newsletterOptIn: false },
          }),
          prisma.newsletterSubscriber.updateMany({
            where: { email: normalizedEmail, active: true },
            data: { active: false },
          }),
        ]);
      },
    );

    if (!authorized) {
      return jsonNoStore(
        { success: false, error: "Nevažeći zahtev za odjavu" },
        400,
      );
    }

    return jsonNoStore(
      {
        success: true,
        message: "Uspešno ste se odjavili sa newsletter-a",
      },
      200,
    );
  } catch {
    // Do not log the bearer token or the subscriber email.
    console.error("Newsletter unsubscribe failed");
    return jsonNoStore(
      { success: false, error: "Odjava trenutno nije dostupna" },
      500,
    );
  }
}

// Legacy campaign links still point here. GET now validates and redirects to
// an explicit confirmation page; it never changes subscription state.
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const token = request.nextUrl.searchParams.get("token");

  try {
    const storefrontUrl = getStorefrontUrl();
    const confirmationUrl = new URL(
      NEWSLETTER_UNSUBSCRIBE_PATH,
      storefrontUrl,
    );
    const normalizedEmail = verifyNewsletterUnsubscribeToken(email, token);

    if (!normalizedEmail || typeof token !== "string") {
      confirmationUrl.searchParams.set("status", "invalid");
      return redirectNoStore(confirmationUrl);
    }

    confirmationUrl.searchParams.set("email", normalizedEmail);
    confirmationUrl.searchParams.set("token", token);
    return redirectNoStore(confirmationUrl);
  } catch {
    console.error("Newsletter unsubscribe link validation failed");
    return jsonNoStore(
      { success: false, error: "Odjava trenutno nije dostupna" },
      500,
    );
  }
}
