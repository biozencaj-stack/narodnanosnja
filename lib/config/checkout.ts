/**
 * Checkout configuration - shipping, free shipping threshold, default country.
 * Configure via environment variables for blank template deployment.
 */

/** Fixed shipping cost (in store currency). NEXT_PUBLIC_ for client cart. */
export const SHIPPING_COST =
  Number(process.env.NEXT_PUBLIC_SHIPPING_COST ?? process.env.SHIPPING_COST) || 0;

/**
 * Order subtotal above which shipping is free.
 * Default 999999999 = always charge shipping (effectively disabled).
 */
export const FREE_SHIPPING_THRESHOLD =
  Number(process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD ?? process.env.FREE_SHIPPING_THRESHOLD) ||
  999999999;

/** Default country for checkout form. Empty = no default, user must select. */
export const DEFAULT_COUNTRY =
  process.env.NEXT_PUBLIC_DEFAULT_COUNTRY || "";
