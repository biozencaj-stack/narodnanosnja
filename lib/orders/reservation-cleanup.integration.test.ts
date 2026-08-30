import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

const RUN_DATABASE_TESTS =
  process.env.RUN_RESERVATION_CLEANUP_DB_TESTS === "true";

function assertSafeTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL je obavezan za integration test cleanup-a rezervacija.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nije validna URL adresa.");
  }

  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error("Integration test zahteva PostgreSQL DATABASE_URL.");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("Naziv baze u DATABASE_URL nije validno kodiran.");
  }

  if (!/(?:^|[_-])(?:e2e|test|provera)(?:$|[_-])/i.test(databaseName)) {
    throw new Error(
      "Integration test je odbijen: naziv baze mora jasno sadržati test, e2e ili provera.",
    );
  }
}

test(
  "DB prefilter i dva cleanup radnika oslobađaju istu rezervaciju tačno jednom",
  { skip: !RUN_DATABASE_TESTS, timeout: 20_000 },
  async () => {
    assertSafeTestDatabase();

    // Dinamički import sprečava i samo otvaranje Prisma klijenta kada test
    // nije eksplicitno uključen.
    const { prisma } = await import("@/lib/db");
    const runId = `reservation-cleanup-${randomUUID()}`;
    const productId = `${runId}-product`;
    const inventoryStockId = `${runId}-stock`;
    const orderId = `${runId}-order`;
    const freshActivityOrderId = `${runId}-fresh-activity-order`;
    const orderItemId = `${runId}-item`;
    const promotionId = `${runId}-promotion`;
    const couponUsageId = `${runId}-coupon-usage`;
    const now = new Date();
    const createdAt = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    try {
      const {
        processOrderReservationCandidate,
        runOrderReservationCleanup,
      } = await import("./reservation-cleanup");

      await prisma.product.create({
        data: {
          id: productId,
          name: { sr: "Cleanup integration proizvod", en: "Cleanup test product" },
          slug: `${runId}-product`,
          price: 100,
          tags: ["reservation-cleanup-integration"],
        },
      });
      await prisma.productSize.create({
        data: {
          id: inventoryStockId,
          productId,
          size: "M",
          stock: 8,
        },
      });
      await prisma.promotion.create({
        data: {
          id: promotionId,
          name: "Cleanup integration kupon",
          type: "FIXED_AMOUNT_OFF",
          value: 10,
          usedCount: 1,
          startDate: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          endDate: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          code: `${runId}-coupon`,
        },
      });
      await prisma.order.create({
        data: {
          id: orderId,
          orderNumber: `${runId}-order-number`,
          shippingStreet: "Test ulica 1",
          shippingCity: "Beograd",
          shippingPostal: "11000",
          paymentMethod: "CARD",
          paymentStatus: "PENDING",
          status: "PENDING",
          subtotal: 200,
          shipping: 0,
          discount: 10,
          total: 190,
          couponCode: `${runId}-coupon`,
          promotionIds: [promotionId],
          inventoryAllocated: true,
          createdAt,
          items: {
            create: {
              id: orderItemId,
              productId,
              inventoryStockId,
              productCode: `${runId}-sku`,
              productName: "Cleanup integration proizvod",
              size: "M",
              quantity: 2,
              price: 100,
            },
          },
        },
      });
      await prisma.order.create({
        data: {
          id: freshActivityOrderId,
          orderNumber: `${runId}-fresh-activity-order-number`,
          shippingStreet: "Test ulica 2",
          shippingCity: "Beograd",
          shippingPostal: "11000",
          paymentMethod: "CARD",
          paymentStatus: "PROCESSING",
          status: "PENDING",
          subtotal: 100,
          shipping: 0,
          discount: 0,
          total: 100,
          inventoryAllocated: true,
          createdAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
          transaction: {
            create: {
              amount: 100,
              currency: "RSD",
              status: "INITIATED",
              createdAt: new Date(now.getTime() - 60 * 60 * 1000),
            },
          },
        },
      });
      await prisma.couponUsage.create({
        data: {
          id: couponUsageId,
          promotionId,
          orderId,
        },
      });

      const preview = await runOrderReservationCleanup({
        now,
        dryRun: true,
        batchSize: 10,
      });
      assert.deepEqual(preview, {
        scanned: 1,
        expired: 1,
        reviewed: 0,
        skipped: 0,
        failed: 0,
        dryRun: true,
      });

      const results = await Promise.all([
        processOrderReservationCandidate(orderId, { now, dryRun: false }),
        processOrderReservationCandidate(orderId, { now, dryRun: false }),
      ]);

      assert.deepEqual([...results].sort(), ["EXPIRED", "SKIPPED"]);

      const [order, inventory, couponUsageCount, promotion] =
        await Promise.all([
          prisma.order.findUnique({
            where: { id: orderId },
            select: {
              status: true,
              paymentStatus: true,
              inventoryAllocated: true,
            },
          }),
          prisma.productSize.findUnique({
            where: { id: inventoryStockId },
            select: { stock: true },
          }),
          prisma.couponUsage.count({ where: { id: couponUsageId } }),
          prisma.promotion.findUnique({
            where: { id: promotionId },
            select: { usedCount: true },
          }),
        ]);

      assert.deepEqual(order, {
        status: "CANCELLED",
        paymentStatus: "FAILED",
        inventoryAllocated: false,
      });
      assert.equal(inventory?.stock, 10);
      assert.equal(couponUsageCount, 0);
      assert.equal(promotion?.usedCount, 0);
    } finally {
      let cleanupError: unknown;
      const cleanupOperations = [
        () => prisma.couponUsage.deleteMany({ where: { id: couponUsageId } }),
        () =>
          prisma.order.deleteMany({
            where: { id: { in: [orderId, freshActivityOrderId] } },
          }),
        () => prisma.promotion.deleteMany({ where: { id: promotionId } }),
        () =>
          prisma.productSize.deleteMany({ where: { id: inventoryStockId } }),
        () => prisma.product.deleteMany({ where: { id: productId } }),
      ];

      for (const cleanup of cleanupOperations) {
        try {
          await cleanup();
        } catch (error) {
          cleanupError ??= error;
        }
      }

      try {
        await prisma.$disconnect();
      } catch (error) {
        cleanupError ??= error;
      }

      if (cleanupError) throw cleanupError;
    }
  },
);
