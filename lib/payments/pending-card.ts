import { clearCheckoutAttemptForOrder } from "@/lib/checkout/idempotency";

export const PENDING_CARD_PAYMENT_KEY = "pending-card-payment";

export interface PendingCardPayment {
  orderId: string;
}

export function readPendingCardPayment(): PendingCardPayment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_CARD_PAYMENT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingCardPayment>;
    if (typeof value.orderId !== "string" || !value.orderId) {
      clearPendingCardPayment();
      return null;
    }
    const sanitized = { orderId: value.orderId };
    if (raw !== JSON.stringify(sanitized)) {
      window.sessionStorage.setItem(PENDING_CARD_PAYMENT_KEY, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch {
    clearPendingCardPayment();
    return null;
  }
}

export function savePendingCardPayment(value: PendingCardPayment): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PENDING_CARD_PAYMENT_KEY, JSON.stringify(value));
  } catch {
    // Retry i dalje radi dok je trenutna checkout komponenta otvorena.
  }
}

export function clearPendingCardPayment(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_CARD_PAYMENT_KEY);
  } catch {
    // Storage može biti onemogućen; nema dodatnog oporavka.
  }
}

/**
 * Terminalni FAILED/REVIEW ishod oslobađa browser za novu porudžbinu. Funkcija
 * namerno ne dira korpu ni cart-clear marker: oni ostaju vezani za originalnu
 * porudžbinu dok korisnik ne dobije potvrđen uspeh ili sam izmeni korpu.
 */
export function clearTerminalCardPaymentAttempt(orderId: string): void {
  if (readPendingCardPayment()?.orderId === orderId) {
    clearPendingCardPayment();
  }
  clearCheckoutAttemptForOrder(orderId);
}
