export class CheckoutQuoteError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "CheckoutQuoteError";
  }
}

export interface CheckoutStockCandidate {
  id: string;
  size: string;
  stock: number;
}

export function resolveCheckoutStock(
  productName: string,
  sizes: CheckoutStockCandidate[],
  requestedSize: string,
  quantity: number,
): CheckoutStockCandidate {
  if (sizes.length === 0) {
    throw new CheckoutQuoteError(
      `Zaliha za proizvod „${productName}” nije podešena. Proizvod trenutno nije dostupan za poručivanje.`,
      "INVENTORY_NOT_CONFIGURED",
      409,
    );
  }

  const stock = sizes.find((entry) => entry.size === requestedSize);
  if (!stock) {
    throw new CheckoutQuoteError(
      `Izaberite dostupnu opciju za „${productName}”`,
      "OPTION_UNAVAILABLE",
      409,
    );
  }
  if (stock.stock < quantity) {
    throw new CheckoutQuoteError(
      `Nema dovoljno proizvoda „${productName}” na stanju`,
      "INSUFFICIENT_STOCK",
      409,
    );
  }

  return stock;
}
