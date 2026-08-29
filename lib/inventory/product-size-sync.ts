import type { Prisma } from "@prisma/client";

const MAX_STOCK = 2_147_483_647;
const MAX_SIZE_LENGTH = 100;

export interface ProductSizeInput {
  id?: unknown;
  size?: unknown;
  stock?: unknown;
  expectedStock?: unknown;
}

export interface ExistingProductSize {
  id: string;
  size: string;
  stock: number;
  active: boolean;
}

interface NormalizedProductSizeInput {
  id?: string;
  size: string;
  stock: number;
  expectedStock?: number;
}

export interface ProductSizeSyncPlan {
  updates: Array<{
    id: string;
    size: string;
    stock: number;
    active: true;
  }>;
  creates: Array<{
    size: string;
    stock: number;
    active: true;
  }>;
  retireIds: string[];
}

export class ProductSizeSyncError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "INVALID_PRODUCT_SIZE",
  ) {
    super(message);
    this.name = "ProductSizeSyncError";
  }
}

export function assertActiveProductHasInventory(
  active: boolean,
  activeSizeCount: number,
): void {
  if (active && activeSizeCount < 1) {
    throw new ProductSizeSyncError(
      "Aktivan proizvod mora imati najmanje jednu veličinu sa podešenom zalihom",
      409,
      "ACTIVE_PRODUCT_REQUIRES_INVENTORY",
    );
  }
}

export function resolveDesiredProductActive(
  currentActive: boolean,
  requestedActive: unknown,
): boolean {
  if (requestedActive === undefined) return currentActive;
  if (typeof requestedActive !== "boolean") {
    throw new ProductSizeSyncError(
      "Status proizvoda nije ispravan",
      400,
      "INVALID_PRODUCT_STATUS",
    );
  }
  return requestedActive;
}

function sizeKey(size: string): string {
  return size.trim().toLocaleLowerCase("sr");
}

function normalizeInputs(inputs: unknown): NormalizedProductSizeInput[] {
  if (!Array.isArray(inputs)) {
    throw new ProductSizeSyncError("Veličine moraju biti poslate kao lista");
  }

  const normalized = inputs.map((raw, index) => {
    if (!raw || typeof raw !== "object") {
      throw new ProductSizeSyncError(`Veličina na poziciji ${index + 1} nije ispravna`);
    }

    const input = raw as ProductSizeInput;
    const size = typeof input.size === "string" ? input.size.trim() : "";
    if (!size || size.length > MAX_SIZE_LENGTH) {
      throw new ProductSizeSyncError(
        `Naziv veličine na poziciji ${index + 1} mora imati od 1 do ${MAX_SIZE_LENGTH} znakova`,
      );
    }

    if (
      typeof input.stock !== "number" ||
      !Number.isInteger(input.stock) ||
      input.stock < 0 ||
      input.stock > MAX_STOCK
    ) {
      throw new ProductSizeSyncError(
        `Zaliha za veličinu „${size}” mora biti nenegativan ceo broj`,
      );
    }

    let id: string | undefined;
    if (input.id !== undefined && input.id !== null && input.id !== "") {
      if (typeof input.id !== "string" || !input.id.trim()) {
        throw new ProductSizeSyncError(`ID veličine „${size}” nije ispravan`);
      }
      id = input.id.trim();
    }

    let expectedStock: number | undefined;
    if (input.expectedStock !== undefined && input.expectedStock !== null) {
      if (
        typeof input.expectedStock !== "number" ||
        !Number.isInteger(input.expectedStock) ||
        input.expectedStock < 0 ||
        input.expectedStock > MAX_STOCK
      ) {
        throw new ProductSizeSyncError(
          `Prethodna zaliha za veličinu „${size}” nije ispravna`,
        );
      }
      expectedStock = input.expectedStock;
    }

    return { id, size, stock: input.stock, expectedStock };
  });

  const names = new Set<string>();
  const ids = new Set<string>();
  for (const input of normalized) {
    const key = sizeKey(input.size);
    if (names.has(key)) {
      throw new ProductSizeSyncError(
        `Veličina „${input.size}” je poslata više puta`,
        409,
        "DUPLICATE_PRODUCT_SIZE",
      );
    }
    names.add(key);

    if (input.id) {
      if (ids.has(input.id)) {
        throw new ProductSizeSyncError(
          "Isti ID veličine je poslat više puta",
          409,
          "DUPLICATE_PRODUCT_SIZE_ID",
        );
      }
      ids.add(input.id);
    }
  }

  return normalized;
}

/**
 * Pravi deterministički plan bez brisanja redova. Postojeći ID ostaje isti
 * čak i kada administrator promeni naziv veličine. Uklonjene veličine se samo
 * povlače iz prodaje kako bi stare porudžbine i dalje mogle tačno da vrate
 * rezervisanu zalihu preko OrderItem.inventoryStockId.
 */
export function planProductSizeSync(
  existing: ExistingProductSize[],
  requested: unknown,
): ProductSizeSyncPlan {
  const inputs = normalizeInputs(requested);
  const existingById = new Map(existing.map((size) => [size.id, size]));
  const claimedIds = new Set<string>();
  const updates: ProductSizeSyncPlan["updates"] = [];
  const creates: ProductSizeSyncPlan["creates"] = [];

  // Eksplicitni ID ima prednost nad kompatibilnim match-om po nazivu.
  for (const input of inputs) {
    if (!input.id) continue;
    const current = existingById.get(input.id);
    if (!current) {
      throw new ProductSizeSyncError(
        `Veličina „${input.size}” ne pripada ovom proizvodu`,
        409,
        "PRODUCT_SIZE_ID_MISMATCH",
      );
    }
    if (input.expectedStock === undefined) {
      throw new ProductSizeSyncError(
        `Osvežite proizvod pre izmene zalihe za veličinu „${input.size}”`,
        409,
        "PRODUCT_SIZE_VERSION_REQUIRED",
      );
    }
    if (current.stock !== input.expectedStock) {
      throw new ProductSizeSyncError(
        `Zaliha za veličinu „${input.size}” je u međuvremenu promenjena. Osvežite formu i pokušajte ponovo.`,
        409,
        "PRODUCT_SIZE_STALE_STOCK",
      );
    }
    const nameOwner = existing.find(
      (size) =>
        size.id !== current.id && sizeKey(size.size) === sizeKey(input.size),
    );
    if (nameOwner) {
      throw new ProductSizeSyncError(
        `Veličina „${input.size}” već postoji; izmenite njen postojeći red`,
        409,
        "PRODUCT_SIZE_NAME_CONFLICT",
      );
    }
    claimedIds.add(current.id);
    updates.push({
      id: current.id,
      size: input.size,
      stock: input.stock,
      active: true,
    });
  }

  for (const input of inputs) {
    if (input.id) continue;

    // Novi red bez ID-a sme da reaktivira ranije povučenu veličinu. Tražena
    // količina tada predstavlja novododatu robu i sabira se sa eventualnim
    // povratom koji je stigao dok je red bio povučen.
    const candidates = existing.filter(
      (current) =>
        !claimedIds.has(current.id) && sizeKey(current.size) === sizeKey(input.size),
    );
    if (candidates.length > 1) {
      throw new ProductSizeSyncError(
        `Postoji više zapisa za veličinu „${input.size}”; osvežite formu i pokušajte ponovo`,
        409,
        "AMBIGUOUS_PRODUCT_SIZE",
      );
    }

    const current = candidates[0];
    if (current) {
      if (current.active) {
        throw new ProductSizeSyncError(
          `Veličina „${input.size}” već postoji. Osvežite formu i pokušajte ponovo.`,
          409,
          "PRODUCT_SIZE_VERSION_REQUIRED",
        );
      }
      const reactivatedStock = current.stock + input.stock;
      if (reactivatedStock > MAX_STOCK) {
        throw new ProductSizeSyncError(
          `Ukupna zaliha za veličinu „${input.size}” je prevelika`,
          409,
          "PRODUCT_SIZE_STOCK_OVERFLOW",
        );
      }
      claimedIds.add(current.id);
      updates.push({
        id: current.id,
        size: input.size,
        stock: reactivatedStock,
        active: true,
      });
    } else {
      creates.push({ size: input.size, stock: input.stock, active: true });
    }
  }

  return {
    updates,
    creates,
    retireIds: existing
      .filter((size) => size.active && !claimedIds.has(size.id))
      .map((size) => size.id),
  };
}

export async function lockProductInventory(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const lockedProducts = await lockProductInventoryRows(tx, [productId]);
  if (!lockedProducts.has(productId)) {
    throw new ProductSizeSyncError(
      "Proizvod više ne postoji",
      404,
      "PRODUCT_NOT_FOUND",
    );
  }
}

/**
 * Svi tokovi koji apsolutno postavljaju ili relativno menjaju ProductSize.stock
 * zaključavaju iste parent Product redove istim sortiranim redosledom. Time
 * admin snimanje ne može da prepiše paralelnu rezervaciju ili povrat zalihe.
 */
export async function lockProductInventoryRows(
  tx: Prisma.TransactionClient,
  productIds: Iterable<string>,
): Promise<Set<string>> {
  const ids = [...new Set(productIds)].sort();
  const locked = new Set<string>();

  // Zaključavanje parent reda serijalizuje svaki admin sync istog proizvoda.
  // Sortirani redosled sprečava deadlock kada porudžbina sadrži više proizvoda.
  for (const productId of ids) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM "Product"
      WHERE id = ${productId}
      FOR UPDATE
    `;
    if (rows.length === 1) {
      locked.add(rows[0].id);
    }
  }

  return locked;
}

export async function syncProductSizes(
  tx: Prisma.TransactionClient,
  productId: string,
  requested: unknown,
): Promise<void> {
  await lockProductInventory(tx, productId);

  const existing = await tx.productSize.findMany({
    where: { productId },
    select: { id: true, size: true, stock: true, active: true },
    orderBy: { id: "asc" },
  });
  const plan = planProductSizeSync(existing, requested);

  for (const update of plan.updates) {
    const changed = await tx.productSize.updateMany({
      where: { id: update.id, productId },
      data: {
        size: update.size,
        stock: update.stock,
        active: update.active,
      },
    });
    if (changed.count !== 1) {
      throw new ProductSizeSyncError(
        "Veličine su paralelno promenjene; osvežite formu i pokušajte ponovo",
        409,
        "PRODUCT_SIZE_CONFLICT",
      );
    }
  }

  if (plan.retireIds.length > 0) {
    await tx.productSize.updateMany({
      where: { productId, id: { in: plan.retireIds } },
      data: { active: false },
    });
  }

  if (plan.creates.length > 0) {
    await tx.productSize.createMany({
      data: plan.creates.map((size) => ({ productId, ...size })),
    });
  }
}
