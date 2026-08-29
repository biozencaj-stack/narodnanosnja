import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";

import {
  InventoryReleaseError,
  releaseOrderInventoryInTransaction,
} from "./inventory";

test("otkazivanje vraća zalihu na isti ID i kada je veličina povučena", async () => {
  const inventoryUpdates: unknown[] = [];
  const lockedProducts: string[] = [];
  const tx = {
    $queryRaw: async (query: TemplateStringsArray, productId: string) => {
      void query;
      lockedProducts.push(productId);
      return [{ id: productId }];
    },
    order: {
      findUnique: async () => ({
        id: "order-1",
        inventoryAllocated: true,
        items: [
          {
            productId: "product-1",
            inventoryStockId: "retired-size-1",
            quantity: 2,
          },
        ],
      }),
      updateMany: async () => ({ count: 1 }),
    },
    productSize: {
      // active se namerno ne proverava: povučen red mora da primi povrat.
      findMany: async () => [
        { id: "retired-size-1", productId: "product-1", active: false },
      ],
      updateMany: async (args: unknown) => {
        inventoryUpdates.push(args);
        return { count: 1 };
      },
    },
  } as unknown as Prisma.TransactionClient;

  assert.equal(await releaseOrderInventoryInTransaction(tx, "order-1"), true);
  assert.deepEqual(lockedProducts, ["product-1"]);
  assert.deepEqual(inventoryUpdates, [
    {
      where: { id: "retired-size-1", productId: "product-1" },
      data: { stock: { increment: 2 } },
    },
  ]);
});

test("nestali snapshot ID prekida otkazivanje pre promene allocation flaga", async () => {
  let claimed = false;
  const tx = {
    $queryRaw: async (_query: TemplateStringsArray, productId: string) => [
      { id: productId },
    ],
    order: {
      findUnique: async () => ({
        id: "order-1",
        inventoryAllocated: true,
        items: [
          {
            productId: "product-1",
            inventoryStockId: "missing-size",
            quantity: 1,
          },
        ],
      }),
      updateMany: async () => {
        claimed = true;
        return { count: 1 };
      },
    },
    productSize: {
      findMany: async () => [],
    },
  } as unknown as Prisma.TransactionClient;

  await assert.rejects(
    releaseOrderInventoryInTransaction(tx, "order-1"),
    InventoryReleaseError,
  );
  assert.equal(claimed, false);
});
