import "server-only";

const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
const DEFAULT_MIN_SCORE = 0.5;

interface RecaptchaProviderResponse {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export interface RecaptchaVerification {
  success: boolean;
  score?: number;
  reason?:
    | "NOT_CONFIGURED"
    | "MISSING_TOKEN"
    | "PROVIDER_ERROR"
    | "LOW_SCORE"
    | "ACTION_MISMATCH"
    | "HOST_MISMATCH";
}

function allowedHostnames(): Set<string> {
  const explicit = (process.env.RECAPTCHA_ALLOWED_HOSTNAMES || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  for (const rawUrl of [process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXTAUTH_URL]) {
    if (!rawUrl) continue;
    try {
      explicit.push(new URL(rawUrl).hostname.toLowerCase());
    } catch {
      // Invalid public URLs are validated separately by the application config.
    }
  }
  return new Set(explicit);
}

export async function verifyRecaptchaToken(
  token: string | null | undefined,
  expectedAction: string,
  remoteIp?: string,
): Promise<RecaptchaVerification> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) {
    return process.env.NODE_ENV === "development"
      ? { success: true, score: 1 }
      : { success: false, reason: "NOT_CONFIGURED" };
  }
  if (!token) return { success: false, reason: "MISSING_TOKEN" };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

    const response = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return { success: false, reason: "PROVIDER_ERROR" };

    const result = (await response.json()) as RecaptchaProviderResponse;
    if (!result.success) return { success: false, reason: "PROVIDER_ERROR" };
    if (result.action !== expectedAction) {
      return { success: false, score: result.score, reason: "ACTION_MISMATCH" };
    }

    const configuredScore = Number(process.env.RECAPTCHA_MIN_SCORE);
    const minimumScore = Number.isFinite(configuredScore)
      ? Math.min(1, Math.max(0, configuredScore))
      : DEFAULT_MIN_SCORE;
    if (typeof result.score !== "number" || result.score < minimumScore) {
      return { success: false, score: result.score, reason: "LOW_SCORE" };
    }

    const hosts = allowedHostnames();
    if (
      hosts.size > 0 &&
      (!result.hostname || !hosts.has(result.hostname.toLowerCase()))
    ) {
      return { success: false, score: result.score, reason: "HOST_MISMATCH" };
    }

    return { success: true, score: result.score };
  } catch {
    return { success: false, reason: "PROVIDER_ERROR" };
  }
}
