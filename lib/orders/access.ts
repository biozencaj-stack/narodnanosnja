import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SECONDS = 24 * 60 * 60;
const PAYMENT_HANDOFF_TTL_SECONDS = 2 * 60;
const MAX_COOKIE_ORDERS = 6;
const COOKIE_VERSION = "v1";

export const ORDER_ACCESS_COOKIE = "shop_order_access";

export function orderAccessCookieName(orderId: string): string {
  const suffix = createHash("sha256")
    .update(orderId)
    .digest("base64url")
    .slice(0, 24);
  return `${ORDER_ACCESS_COOKIE}_${suffix}`;
}

export function orderAccessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEFAULT_TTL_SECONDS,
  };
}

export function createOrderAccessCookieValue(
  _orderId: string,
  token: string,
  _currentValue?: string | null,
): string {
  return token;
}

export function getOrderAccessTokenFromCookie(
  orderId: string,
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  if (!value.startsWith(`${COOKIE_VERSION}.`) && !value.includes(":")) {
    return verifyOrderAccessToken(orderId, value) ? value : null;
  }
  const token = parseCookieEntries(value).find(
    ([storedOrderId]) => storedOrderId === orderId,
  )?.[1];
  return token && verifyOrderAccessToken(orderId, token) ? token : null;
}

function parseCookieEntries(
  value: string | null | undefined,
): ReadonlyArray<readonly [string, string]> {
  if (!value) return [];

  if (value.startsWith(`${COOKIE_VERSION}.`)) {
    try {
      const decoded = JSON.parse(
        Buffer.from(value.slice(COOKIE_VERSION.length + 1), "base64url").toString(
          "utf8",
        ),
      ) as unknown;
      if (!Array.isArray(decoded)) return [];
      return decoded
        .filter(
          (entry): entry is [string, string] =>
            Array.isArray(entry) &&
            entry.length === 2 &&
            typeof entry[0] === "string" &&
            entry[0].length > 0 &&
            entry[0].length <= 128 &&
            typeof entry[1] === "string" &&
            entry[1].length > 0 &&
            entry[1].length <= 512,
        )
        .slice(-MAX_COOKIE_ORDERS);
    } catch {
      return [];
    }
  }

  // Backwards compatibility for the original single-order cookie.
  const separator = value.indexOf(":");
  if (separator < 1) return [];
  return [[value.slice(0, separator), value.slice(separator + 1)]];
}

function secret(): string {
  const value = process.env.ORDER_ACCESS_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) {
    throw new Error(
      "ORDER_ACCESS_SECRET ili NEXTAUTH_SECRET mora biti podešen za pristup porudžbini",
    );
  }
  return value;
}

function signature(scope: string, expiresAt: number): string {
  return createHmac("sha256", secret())
    .update(`${scope}.${expiresAt}`)
    .digest("base64url");
}

/** Kratkotrajni potpisani token za guest success/payment stranice. */
export function createOrderAccessToken(
  orderId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${expiresAt}.${signature(`order:${orderId}`, expiresAt)}`;
}

export function verifyOrderAccessToken(
  orderId: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const [expiresRaw, supplied] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  try {
    const expected = signature(`order:${orderId}`, expiresAt);
    const a = Buffer.from(supplied || "", "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Kratkotrajna, order-scoped dozvola za drugi (top-level) POST kojim browser
 * napušta shop i šalje već pripremljen HPP payload banci. Ne čuva se u URL-u
 * niti u storage-u i ne može se upotrebiti za čitanje podataka porudžbine.
 */
export function createPaymentHandoffToken(
  orderId: string,
  ttlSeconds = PAYMENT_HANDOFF_TTL_SECONDS,
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${expiresAt}.${signature(`payment-handoff:${orderId}`, expiresAt)}`;
}

export function verifyPaymentHandoffToken(
  orderId: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const [expiresRaw, supplied] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  try {
    const expected = signature(`payment-handoff:${orderId}`, expiresAt);
    const a = Buffer.from(supplied || "", "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyCheckoutIdempotencyKey(
  expected: string | null | undefined,
  supplied: string | null | undefined,
): boolean {
  if (
    !expected ||
    !supplied ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(supplied)
  ) {
    return false;
  }
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(supplied, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
