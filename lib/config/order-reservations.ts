/**
 * Checkout recovery and abandoned-card-order windows share one source of
 * truth. The pending window is intentionally fixed because browser recovery
 * and idempotency currently promise the same two-hour lifetime.
 */
export const ORDER_PENDING_RECOVERY_WINDOW_MS = 2 * 60 * 60 * 1000;

export const ORDER_PROCESSING_REVIEW_MINUTES_ENV =
  "ORDER_PROCESSING_REVIEW_MINUTES";

export const DEFAULT_ORDER_PROCESSING_REVIEW_MINUTES = 24 * 60;
export const MIN_ORDER_PROCESSING_REVIEW_MINUTES = 2 * 60;
export const MAX_ORDER_PROCESSING_REVIEW_MINUTES = 7 * 24 * 60;

export interface OrderReservationWindows {
  pendingRecoveryMs: number;
  processingReviewMs: number;
}

type Environment = Readonly<Record<string, string | undefined>>;

function invalidProcessingReviewWindow(): Error {
  return new Error(
    `${ORDER_PROCESSING_REVIEW_MINUTES_ENV} mora biti ceo broj minuta između ` +
      `${MIN_ORDER_PROCESSING_REVIEW_MINUTES} i ` +
      `${MAX_ORDER_PROCESSING_REVIEW_MINUTES}`,
  );
}

/**
 * Missing configuration uses the conservative 24-hour default. A present but
 * malformed/out-of-range value fails closed instead of silently shortening a
 * live provider reconciliation window.
 */
export function parseOrderProcessingReviewMs(
  rawValue: string | undefined,
): number {
  if (rawValue === undefined) {
    return DEFAULT_ORDER_PROCESSING_REVIEW_MINUTES * 60 * 1000;
  }

  // Reject whitespace, signs, decimals, exponents and leading zeroes. This
  // keeps deployment configuration unambiguous across Node/shell parsers.
  if (!/^[1-9][0-9]*$/.test(rawValue)) {
    throw invalidProcessingReviewWindow();
  }

  const minutes = Number(rawValue);
  if (
    !Number.isSafeInteger(minutes) ||
    minutes < MIN_ORDER_PROCESSING_REVIEW_MINUTES ||
    minutes > MAX_ORDER_PROCESSING_REVIEW_MINUTES
  ) {
    throw invalidProcessingReviewWindow();
  }

  return minutes * 60 * 1000;
}

export function resolveOrderReservationWindows(
  environment: Environment = process.env,
): OrderReservationWindows {
  return {
    pendingRecoveryMs: ORDER_PENDING_RECOVERY_WINDOW_MS,
    processingReviewMs: parseOrderProcessingReviewMs(
      environment[ORDER_PROCESSING_REVIEW_MINUTES_ENV],
    ),
  };
}

export const ORDER_RESERVATION_WINDOWS = Object.freeze(
  resolveOrderReservationWindows(),
);
