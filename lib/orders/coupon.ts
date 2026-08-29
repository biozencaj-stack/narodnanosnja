import type { Prisma } from "@prisma/client";

export class CouponReleaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "CouponReleaseError";
  }
}

/**
 * Oslobađa sve coupon usage zapise vezane za porudžbinu i vraća usedCount u
 * istoj transakciji. Brisanje usage reda je exactly-once marker: ponovljen
 * callback/cancel nema šta ponovo da decrementuje.
 */
export async function releaseOrderCouponInTransaction(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const usages = await tx.couponUsage.findMany({
    where: { orderId },
    select: { id: true, promotionId: true },
  });
  if (usages.length === 0) return;

  const usageCountByPromotion = new Map<string, number>();
  for (const usage of usages) {
    usageCountByPromotion.set(
      usage.promotionId,
      (usageCountByPromotion.get(usage.promotionId) || 0) + 1,
    );
  }

  const removed = await tx.couponUsage.deleteMany({
    where: { id: { in: usages.map((usage) => usage.id) } },
  });
  if (removed.count !== usages.length) {
    throw new CouponReleaseError(
      "Kupon porudžbine je paralelno promenjen",
      "COUPON_RELEASE_CONFLICT",
    );
  }

  for (const [promotionId, count] of usageCountByPromotion) {
    const decremented = await tx.promotion.updateMany({
      where: { id: promotionId, usedCount: { gte: count } },
      data: { usedCount: { decrement: count } },
    });
    if (decremented.count !== 1) {
      throw new CouponReleaseError(
        "Brojač upotrebe kupona nije usklađen",
        "COUPON_USAGE_COUNT_INCONSISTENT",
      );
    }
  }
}
