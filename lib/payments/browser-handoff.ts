import { getCheckoutIdempotencyKeyForOrder } from "@/lib/checkout/idempotency";

export class PaymentStartClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly clearPending = false,
    public readonly review = false,
  ) {
    super(message);
    this.name = "PaymentStartClientError";
  }
}

/**
 * Prvi same-origin poziv autorizuje porudžbinu i dobija kratkotrajni handoff.
 * Drugi zahtev je pravi top-level POST, pa browser primenjuje strogi CSP
 * dokumenta koji auto-postuje već potpisan payload banci.
 */
export async function submitNestPayHandoff(
  orderId: string,
  currentAttemptKey?: string,
): Promise<void> {
  const idempotencyKey =
    currentAttemptKey || getCheckoutIdempotencyKeyForOrder(orderId);
  const response = await fetch("/api/payments/nestpay/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: JSON.stringify({ orderId }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    clearPending?: boolean;
    review?: boolean;
    handoffToken?: string;
  };

  if (!response.ok) {
    throw new PaymentStartClientError(
      data.error || "Pokretanje plaćanja nije uspelo",
      data.code,
      data.clearPending === true,
      data.review === true,
    );
  }
  if (!data.handoffToken) {
    throw new PaymentStartClientError(
      "Server nije vratio bezbedan nastavak plaćanja",
    );
  }

  const handoff = document.createElement("form");
  handoff.method = "POST";
  handoff.action = "/api/payments/nestpay/start";
  handoff.hidden = true;

  for (const [name, value] of [
    ["orderId", orderId],
    ["handoffToken", data.handoffToken],
  ]) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    handoff.appendChild(input);
  }

  document.body.appendChild(handoff);
  handoff.submit();
}
