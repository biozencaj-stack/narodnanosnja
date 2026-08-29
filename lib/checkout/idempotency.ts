const CHECKOUT_ATTEMPT_KEY = "checkout-idempotency-attempt";

interface CheckoutAttempt {
  key: string;
  orderId?: string;
}

function createKey(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi) {
    throw new Error("Browser nema bezbedan generator checkout ključa");
  }
  if (typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(24);
  cryptoApi.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function readAttempt(): CheckoutAttempt | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(
      window.sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY) || "null",
    ) as Partial<CheckoutAttempt> | null;
    if (
      !value ||
      typeof value.key !== "string" ||
      !/^[A-Za-z0-9_-]{32,128}$/.test(value.key)
    ) {
      return null;
    }
    return {
      key: value.key,
      orderId:
        typeof value.orderId === "string" && value.orderId
          ? value.orderId
          : undefined,
    };
  } catch {
    return null;
  }
}

export function getOrCreateCheckoutIdempotencyKey(): string {
  const existing = readAttempt();
  if (existing) return existing.key;
  const key = createKey();
  try {
    window.sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify({ key }));
  } catch {
    // Ključ se i dalje koristi za trenutni zahtev. Browser bez sessionStorage
    // ne može garantovati idempotency kroz kompletan reload.
  }
  return key;
}

export function bindCheckoutAttemptToOrder(key: string, orderId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      CHECKOUT_ATTEMPT_KEY,
      JSON.stringify({ key, orderId }),
    );
  } catch {
    // Bezbednost servera i dalje počiva na unique idempotency ključu.
  }
}

export function getCheckoutIdempotencyKeyForOrder(
  orderId: string,
): string | null {
  const attempt = readAttempt();
  return attempt?.orderId === orderId ? attempt.key : null;
}

export function clearCheckoutAttemptForOrder(orderId: string): void {
  if (typeof window === "undefined") return;
  try {
    const attempt = readAttempt();
    if (attempt?.orderId === orderId) {
      window.sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY);
    }
  } catch {
    // Nema dodatnog oporavka za nedostupan storage.
  }
}
