import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyRecaptchaToken } from "@/lib/security/recaptcha";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(`recaptcha:${ip}`, 30)) {
    return NextResponse.json({ success: false, error: "Previše zahteva" }, { status: 429 });
  }

  try {
    const body = (await request.json()) as { token?: string; action?: string };
    if (!body.action) {
      return NextResponse.json(
        { success: false, error: "reCAPTCHA action is required" },
        { status: 400 },
      );
    }

    const result = await verifyRecaptchaToken(body.token, body.action, ip);
    return NextResponse.json(
      result.success
        ? { success: true, score: result.score }
        : { success: false, error: "reCAPTCHA verifikacija nije uspela" },
      {
        status: result.success ? 200 : result.reason === "NOT_CONFIGURED" ? 503 : 400,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Greška pri reCAPTCHA verifikaciji" },
      { status: 400 },
    );
  }
}
