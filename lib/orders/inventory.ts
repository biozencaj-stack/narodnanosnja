import type { Prisma } from "@prisma/client";

export class InventoryReleaseError extends Error {
  constructor(
    message: string,
    public readonly code = "INVENTORY_RELEASE_CONFLICT",
  ) {
    super(message);
    this.name = "InventoryReleaseError";
  }
}

/**
 * Mora se pozvati unutar transakcije koja menja status porudžbine. CAS nad
 * inventoryAllocated obezbeđuje exactly-once claim, a svako neuspešno tačno
 * vraćanje baca grešku i vraća čitavu transakciju unazad.
 */
export async function releaseOrderInventoryInTransaction(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<boolean> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order?.inventoryAllocated) return false;

  const exactAllocations = new Map<
    string,
    { productId: string; quantity: number }
  >();

  for (const item of order.items) {
    if (!item.productId) continue;

    if (item.inventoryStockId) {
      const existing = exactAllocations.get(item.inventoryStockId);
      if (existing && existing.productId !== item.productId) {
        throw new InventoryReleaseError(
          "Jedan zapis zalihe je vezan za više proizvoda u istoj porudžbini",
        );
      }
      exactAllocations.set(item.inventoryStockId, {
        productId: item.productId,
        quantity: (existing?.quantity || 0) + item.quantity,
      });
    }
  }

  // Nikada ne pogađamo rezervaciju preko promenljivog productId+size para.
  // Null je legitiman za nepraćenu stavku u mešovitoj korpi; porudžbina koja
  // tvrdi da ima rezervaciju, a nema nijedan snapshot ID, zahteva backfill ili
  // ručnu proveru umesto phantom povećanja zalihe.
  if (exactAllocations.size === 0) {
    throw new InventoryReleaseError(
      "Porudžbina nema tačan snapshot rezervisane zalihe",
      "INVENTORY_ALLOCATION_MAPPING_MISSING",
    );
  }

  const exactIds = [...exactAllocations.keys()];
  if (exactIds.length > 0) {
    const existingStocks = await tx.productSize.findMany({
      where: { id: { in: exactIds } },
      select: { id: true, productId: true },
    });
    const stocksById = new Map(existingStocks.map((stock) => [stock.id, stock]));

    for (const [stockId, allocation] of exactAllocations) {
      const stock = stocksById.get(stockId);
      if (!stock || stock.productId !== allocation.productId) {
        throw new InventoryReleaseError(
          "Rezervisani zapis zalihe više ne postoji ili pripada drugom proizvodu",
        );
      }
    }
  }

  const claimed = await tx.order.updateMany({
    where: { id: orderId, inventoryAllocated: true },
    data: { inventoryAllocated: false },
  });
  if (claimed.count !== 1) return false;

  const allocations = [...exactAllocations.entries()].map(
    ([stockId, allocation]) => ({
      stockId,
      ...allocation,
    }),
  );

  for (const allocation of allocations) {
    const released = await tx.productSize.updateMany({
      where: {
        id: allocation.stockId,
        productId: allocation.productId,
      },
      data: { stock: { increment: allocation.quantity } },
    });
    if (released.count !== 1) {
      throw new InventoryReleaseError(
        "Zaliha nije mogla bezbedno da se vrati; porudžbina je poslata na ponovni pokušaj",
      );
    }
  }

  return true;
}
