import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";

import { releaseOrderCouponInTransaction } from "./coupon";

test("coupon counters are released in deterministic promotion ID order", async () => {
  const promotionUpdates: unknown[] = [];
  const tx = {
    couponUsage: {
      findMany: async () => [
        { id: "usage-b-1", promotionId: "promotion-b" },
        { id: "usage-a", promotionId: "promotion-a" },
        { id: "usage-b-2", promotionId: "promotion-b" },
      ],
      deleteMany: async () => ({ count: 3 }),
    },
    promotion: {
      updateMany: async (args: unknown) => {
        promotionUpdates.push(args);
        return { count: 1 };
      },
    },
  } as unknown as Prisma.TransactionClient;

  await releaseOrderCouponInTransaction(tx, "order-1");

  assert.deepEqual(promotionUpdates, [
    {
      where: { id: "promotion-a", usedCount: { gte: 1 } },
      data: { usedCount: { decrement: 1 } },
    },
    {
      where: { id: "promotion-b", usedCount: { gte: 2 } },
      data: { usedCount: { decrement: 2 } },
    },
  ]);
});
