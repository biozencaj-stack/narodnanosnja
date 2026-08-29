const CART_CLEAR_MARKER_KEY = "checkout-cart-clear-marker";

interface FingerprintItem {
  id: string;
  size?: string;
  quantity: number;
}

interface CartClearMarker {
  orderId: string;
  fingerprint: string;
}

export function createCartFingerprint(items: FingerprintItem[]): string {
  return JSON.stringify(
    items
      .map((item) => ({
        id: String(item.id),
        size: String(item.size || ""),
        quantity: Number(item.quantity),
      }))
      .sort((a, b) =>
        `${a.id}\u0000${a.size}`.localeCompare(`${b.id}\u0000${b.size}`),
      ),
  );
}

export function markCartForOrderClear(
  orderId: string,
  items: FingerprintItem[],
): void {
  if (typeof window === "undefined") return;
  try {
    const marker: CartClearMarker = {
      orderId,
      fingerprint: createCartFingerprint(items),
    };
    window.sessionStorage.setItem(CART_CLEAR_MARKER_KEY, JSON.stringify(marker));
  } catch {
    // Ako storage nije dostupan, čuvamo korisnikovu korpu umesto da rizikujemo
    // brisanje neke kasnije korpe sa istorijske success stranice.
  }
}

export function consumeCartClearMarker(
  orderId: string,
  currentItems: FingerprintItem[],
): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(CART_CLEAR_MARKER_KEY);
    if (!raw) return false;
    const marker = JSON.parse(raw) as Partial<CartClearMarker>;
    if (marker.orderId !== orderId) return false;

    window.sessionStorage.removeItem(CART_CLEAR_MARKER_KEY);
    return marker.fingerprint === createCartFingerprint(currentItems);
  } catch {
    return false;
  }
}
