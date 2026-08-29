import { prisma } from "@/lib/db";
import type { PaymentMethod, PaymentStatus, OrderStatus } from "@prisma/client";
import type { CheckoutQuote } from "@/lib/checkout/quote";
import { lockProductInventoryRows } from "@/lib/inventory/product-size-sync";

export interface CreateOrderInput {
  // Customer info (either userId or guest info)
  userId?: string;
  guestEmail?: string;
  guestFirstName?: string;
  guestLastName?: string;
  guestPhone?: string;

  // Shipping address
  shippingStreet: string;
  shippingCity: string;
  shippingPostal: string;
  shippingCountry?: string;

  // Payment
  paymentMethod: "CASH" | "CARD";

  // Amounts
  subtotal: number;
  shipping: number;
  discount?: number;
  total: number;

  // Promotions
  couponCode?: string | null;
  promotionIds?: string[];

  // Optional
  note?: string;

  // Items
  items: {
    productCode: string;
    productName: string;
    size: string;
    quantity: number;
    price: number;
    picture?: string;
  }[];
}

export interface CreateSecureOrderInput {
  checkoutIdempotencyKey: string;
  userId?: string;
  guestEmail: string;
  guestFirstName: string;
  guestLastName: string;
  guestPhone: string;
  shippingStreet: string;
  shippingCity: string;
  shippingPostal: string;
  shippingCountry: string;
  paymentMethod: "CASH" | "CARD";
  note?: string;
  quote: CheckoutQuote;
}

export class OrderInventoryError extends Error {
  constructor(
    message: string,
    public readonly code = "INVENTORY_CONFLICT",
  ) {
    super(message);
    this.name = "OrderInventoryError";
  }
}

/**
 * Generate unique order number
 */
export function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

/**
 * Create a new order in the database
 */
export async function createOrder(input: CreateOrderInput) {
  const orderNumber = generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: input.userId,
      guestEmail: input.guestEmail,
      guestFirstName: input.guestFirstName,
      guestLastName: input.guestLastName,
      guestPhone: input.guestPhone,
      shippingStreet: input.shippingStreet,
      shippingCity: input.shippingCity,
      shippingPostal: input.shippingPostal,
      shippingCountry: input.shippingCountry ?? "",
      paymentMethod: input.paymentMethod as PaymentMethod,
      paymentStatus: "PENDING" as PaymentStatus,
      status: "PENDING" as OrderStatus,
      subtotal: input.subtotal,
      shipping: input.shipping,
      discount: input.discount || 0,
      total: input.total,
      couponCode: input.couponCode || null,
      promotionIds: input.promotionIds || [],
      note: input.note,
      items: {
        create: input.items.map((item) => ({
          productCode: item.productCode,
          productName: item.productName,
          size: item.size,
          quantity: item.quantity,
          price: item.price,
          picture: item.picture,
        })),
      },
    },
    include: {
      items: true,
    },
  });

  // Clean up wishlist - remove purchased items for logged-in users
  if (input.userId) {
    try {
      // Get all product codes from the order
      const productCodes = input.items.map((item) => item.productCode);

      // Delete wishlist items that match the purchased product codes
      // Wishlist productId format is: code-color-model, so we match by code prefix
      await prisma.wishlist.deleteMany({
        where: {
          userId: input.userId,
          productId: {
            in: productCodes.map((code) => code), // Match exact codes
          },
        },
      });

      // Also try to match by productId starting with the code
      for (const code of productCodes) {
        await prisma.wishlist.deleteMany({
          where: {
            userId: input.userId,
            productId: {
              startsWith: `${code}-`,
            },
          },
        });
      }
    } catch (error) {
      // Don't fail the order if wishlist cleanup fails
      console.error("Failed to clean wishlist after order:", error);
    }
  }

  return order;
}

/**
 * Kreira porudžbinu iz serverskog quote-a i atomarno skida zalihu. Cene,
 * popusti i snapshot stavki nikada ne dolaze iz browsera.
 */
export async function createSecureOrder(input: CreateSecureOrderInput) {
  const orderNumber = generateOrderNumber();

  return prisma.$transaction(
    async (tx) => {
      // Admin izmena zalihe, rezervacija i povrat koriste isti parent lock.
      // Bez ovoga bi apsolutni admin stock mogao da prepiše paralelni decrement.
      await lockProductInventoryRows(
        tx,
        input.quote.lines.map((line) => line.productId),
      );

      // Cene mogu biti promenjene između quote-a i transakcije. Pre upisa
      // proveravamo da je quote i dalje aktuelan.
      const products = await tx.product.findMany({
        where: { id: { in: input.quote.lines.map((line) => line.productId) } },
        select: {
          id: true,
          active: true,
          price: true,
          salePrice: true,
        },
      });
      const productsById = new Map(products.map((product) => [product.id, product]));

      for (const line of input.quote.lines) {
        const product = productsById.get(line.productId);
        const regularPrice = product ? Number(product.price) : NaN;
        const salePrice = product?.salePrice ? Number(product.salePrice) : null;
        const effectivePrice =
          salePrice !== null && salePrice > 0 && salePrice < regularPrice
            ? salePrice
            : regularPrice;

        if (!product?.active || Math.abs(effectivePrice - line.unitPrice) > 0.001) {
          throw new OrderInventoryError(
            "Cena ili dostupnost proizvoda je promenjena. Osvežite korpu i pokušajte ponovo.",
            "QUOTE_CHANGED",
          );
        }

        const reserved = await tx.productSize.updateMany({
          where: {
            id: line.stockId,
            productId: line.productId,
            active: true,
            stock: { gte: line.quantity },
          },
          data: { stock: { decrement: line.quantity } },
        });
        if (reserved.count !== 1) {
          throw new OrderInventoryError(
            `Nema dovoljno proizvoda „${line.productName}” na stanju`,
            "INSUFFICIENT_STOCK",
          );
        }
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          checkoutIdempotencyKey: input.checkoutIdempotencyKey,
          userId: input.userId,
          guestEmail: input.guestEmail,
          guestFirstName: input.guestFirstName,
          guestLastName: input.guestLastName,
          guestPhone: input.guestPhone,
          shippingStreet: input.shippingStreet,
          shippingCity: input.shippingCity,
          shippingPostal: input.shippingPostal,
          shippingCountry: input.shippingCountry,
          paymentMethod: input.paymentMethod as PaymentMethod,
          paymentStatus: "PENDING" as PaymentStatus,
          status: "PENDING" as OrderStatus,
          subtotal: input.quote.subtotal,
          shipping: input.quote.shipping,
          discount: input.quote.discount,
          total: input.quote.total,
          currency: input.quote.currency,
          couponCode: input.quote.couponCode,
          promotionIds: input.quote.promotionIds,
          inventoryAllocated: true,
          note: input.note,
          items: {
            create: input.quote.lines.map((line) => ({
              productId: line.productId,
              inventoryStockId: line.stockId,
              productCode: line.productCode,
              productName: line.productName,
              size: line.size,
              quantity: line.quantity,
              price: line.unitPrice,
              picture: line.picture,
            })),
          },
        },
        include: { items: true },
      });

      if (input.quote.couponCode && input.quote.couponPromotionId) {
        const promotion = await tx.promotion.findUnique({
          where: { id: input.quote.couponPromotionId },
          select: { id: true, maxUses: true, usedCount: true },
        });
        if (
          !promotion ||
          (promotion.maxUses !== null && promotion.usedCount >= promotion.maxUses)
        ) {
          throw new OrderInventoryError(
            "Kupon je u međuvremenu iskorišćen",
            "COUPON_EXHAUSTED",
          );
        }

        if (input.userId) {
          const previous = await tx.couponUsage.findFirst({
            where: { promotionId: promotion.id, userId: input.userId },
            select: { id: true },
          });
          if (previous) {
            throw new OrderInventoryError(
              "Ovaj kupon je već iskorišćen",
              "COUPON_ALREADY_USED",
            );
          }
        }

        await tx.couponUsage.create({
          data: {
            promotionId: promotion.id,
            userId: input.userId || null,
            orderId: order.id,
          },
        });
        await tx.promotion.update({
          where: { id: promotion.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      if (input.userId) {
        await tx.wishlist.deleteMany({
          where: {
            userId: input.userId,
            productId: { in: input.quote.lines.map((line) => line.productId) },
          },
        });
      }

      return order;
    },
    { isolationLevel: "Serializable" },
  );
}

/**
 * Get order by ID with all relations
 */
export async function getOrderById(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      transaction: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * Get order by order number
 */
export async function getOrderByNumber(orderNumber: string) {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      transaction: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * Get orders for a user
 */
export async function getUserOrders(userId: string) {
  return prisma.order.findMany({
    where: { userId },
    include: {
      items: true,
      transaction: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get all orders (for admin)
 */
export async function getAllOrders(options?: {
  limit?: number;
  offset?: number;
  status?: OrderStatus;
}) {
  const where = options?.status ? { status: options.status } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        items: true,
        transaction: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: options?.limit,
      skip: options?.offset,
    }),
    prisma.order.count({ where }),
  ]);

  return { orders, total };
}
