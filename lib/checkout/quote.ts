import { prisma } from "@/lib/db";
import { getLocalized } from "@/lib/i18n/localized";
import {
  calculateCartDiscount,
  validateCoupon,
} from "@/lib/promotions";
import { getStoreCommerceSettings } from "@/lib/config/store-settings";

export interface CheckoutRequestItem {
  productId: string;
  size?: string;
  quantity: number;
}

export interface CheckoutQuoteLine {
  productId: string;
  stockId: string | null;
  productCode: string;
  productName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  picture?: string;
}

export interface CheckoutQuote {
  lines: CheckoutQuoteLine[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  currency: "RSD";
  promotions: {
    id: string;
    name: string;
    type: string;
    discount: number;
    description: string;
  }[];
  promotionIds: string[];
  couponCode: string | null;
  couponPromotionId: string | null;
}

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

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function normalizeItems(items: CheckoutRequestItem[]): CheckoutRequestItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutQuoteError("Korpa ne sme biti prazna", "EMPTY_CART");
  }
  if (items.length > 100) {
    throw new CheckoutQuoteError(
      "Korpa može imati najviše 100 različitih stavki",
      "CART_TOO_LARGE",
    );
  }

  const merged = new Map<string, CheckoutRequestItem>();
  for (const item of items) {
    const productId = typeof item?.productId === "string" ? item.productId.trim() : "";
    const size = typeof item?.size === "string" ? item.size.trim() : "";
    const quantity = Number(item?.quantity);

    if (
      !productId ||
      productId.length > 128 ||
      size.length > 100 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {
      throw new CheckoutQuoteError("Neispravan artikal u korpi", "INVALID_ITEM");
    }

    const key = `${productId}\u0000${size}`;
    const previous = merged.get(key);
    const nextQuantity = (previous?.quantity || 0) + quantity;
    if (nextQuantity > 99) {
      throw new CheckoutQuoteError(
        "Maksimalna količina jednog artikla je 99",
        "INVALID_QUANTITY",
      );
    }
    merged.set(key, { productId, size, quantity: nextQuantity });
  }

  return [...merged.values()];
}

/**
 * Jedini autoritativni obračun korpe. Browser šalje samo identitet proizvoda,
 * izabranu opciju i količinu; cene, akcije, dostava i zaliha dolaze iz baze.
 */
export async function buildCheckoutQuote(
  rawItems: CheckoutRequestItem[],
  options: { couponCode?: string | null; userId?: string } = {},
): Promise<CheckoutQuote> {
  const commerceSettings = await getStoreCommerceSettings();
  const items = normalizeItems(rawItems);
  const productIds = [...new Set(items.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
    include: { sizes: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));

  if (products.length !== productIds.length) {
    throw new CheckoutQuoteError(
      "Jedan ili više proizvoda više nisu dostupni",
      "PRODUCT_UNAVAILABLE",
      409,
    );
  }

  const lines: CheckoutQuoteLine[] = items.map((item) => {
    const product = byId.get(item.productId)!;
    const regularPrice = Number(product.price);
    const salePrice = product.salePrice ? Number(product.salePrice) : null;
    const unitPrice =
      salePrice !== null && salePrice > 0 && salePrice < regularPrice
        ? salePrice
        : regularPrice;

    let stockId: string | null = null;
    let selectedSize = item.size || "Podrazumevano";
    if (product.sizes.length > 0) {
      const stock = product.sizes.find((entry) => entry.size === item.size);
      if (!stock) {
        throw new CheckoutQuoteError(
          `Izaberite dostupnu opciju za „${getLocalized(product.name, "sr")}”`,
          "OPTION_UNAVAILABLE",
          409,
        );
      }
      if (stock.stock < item.quantity) {
        throw new CheckoutQuoteError(
          `Nema dovoljno proizvoda „${getLocalized(product.name, "sr")}” na stanju`,
          "INSUFFICIENT_STOCK",
          409,
        );
      }
      stockId = stock.id;
      selectedSize = stock.size;
    }

    return {
      productId: product.id,
      stockId,
      productCode: product.sku || product.id,
      productName: getLocalized(product.name, "sr"),
      size: selectedSize,
      quantity: item.quantity,
      unitPrice: money(unitPrice),
      lineTotal: money(unitPrice * item.quantity),
      picture: product.image1 || undefined,
    };
  });

  const subtotal = money(lines.reduce((sum, line) => sum + line.lineTotal, 0));
  if (subtotal < commerceSettings.minimumOrderSubtotal) {
    throw new CheckoutQuoteError(
      `Minimalna vrednost porudžbine je ${commerceSettings.minimumOrderSubtotal.toLocaleString("sr-RS")} RSD`,
      "MINIMUM_ORDER_NOT_MET",
    );
  }
  const normalizedCoupon = options.couponCode?.trim().toUpperCase() || null;
  let couponPromotionId: string | null = null;

  if (normalizedCoupon) {
    const validation = await validateCoupon(normalizedCoupon, options.userId);
    if (!validation.valid || !validation.promotion) {
      throw new CheckoutQuoteError(
        validation.error || "Kupon nije važeći",
        "INVALID_COUPON",
      );
    }
    couponPromotionId = validation.promotion.id;
  }

  const promotionResult = await calculateCartDiscount(
    lines.map((line) => ({
      productId: line.productId,
      price: line.unitPrice,
      quantity: line.quantity,
    })),
    normalizedCoupon || undefined,
    options.userId,
  );

  if (
    couponPromotionId &&
    !promotionResult.promotions.some((promotion) => promotion.id === couponPromotionId)
  ) {
    throw new CheckoutQuoteError(
      "Korpa ne ispunjava uslove za ovaj kupon",
      "COUPON_CONDITIONS_NOT_MET",
    );
  }

  const discount = money(
    Math.min(subtotal, Math.max(0, promotionResult.totalDiscount)),
  );
  const shipping = promotionResult.freeShipping || subtotal >= commerceSettings.freeShippingThreshold
    ? 0
    : money(commerceSettings.shippingCost);
  const total = money(Math.max(0, subtotal - discount + shipping));

  return {
    lines,
    subtotal,
    shipping,
    discount,
    total,
    currency: "RSD",
    promotions: promotionResult.promotions,
    promotionIds: promotionResult.promotions.map((promotion) => promotion.id),
    couponCode: couponPromotionId ? normalizedCoupon : null,
    couponPromotionId,
  };
}
