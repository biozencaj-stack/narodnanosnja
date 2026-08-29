import assert from "node:assert/strict";
import test from "node:test";

import {
  assertActiveProductHasInventory,
  lockProductInventoryRows,
  ProductSizeSyncError,
  planProductSizeSync,
  resolveDesiredProductActive,
  type ExistingProductSize,
} from "./product-size-sync";

const existing: ExistingProductSize[] = [
  { id: "size-s", size: "S", stock: 7, active: true },
  { id: "size-m", size: "M", stock: 4, active: true },
  { id: "size-old", size: "XL", stock: 0, active: false },
];

test("izmena zalihe i naziva čuva postojeći ProductSize ID", () => {
  const plan = planProductSizeSync(existing, [
    { id: "size-s", size: "XS/S", stock: 11, expectedStock: 7 },
    { id: "size-m", size: "M", stock: 3, expectedStock: 4 },
  ]);

  assert.deepEqual(plan.updates, [
    { id: "size-s", size: "XS/S", stock: 11, active: true },
    { id: "size-m", size: "M", stock: 3, active: true },
  ]);
  assert.deepEqual(plan.creates, []);
  assert.deepEqual(plan.retireIds, []);
});

test("uklonjeni red se povlači umesto brisanja", () => {
  const plan = planProductSizeSync(existing, [
    { id: "size-s", size: "S", stock: 7, expectedStock: 7 },
  ]);

  assert.deepEqual(plan.retireIds, ["size-m"]);
  assert.equal(plan.updates[0].id, "size-s");
});

test("ponovno dodavanje povučene veličine reaktivira isti ID", () => {
  const plan = planProductSizeSync(existing, [
    { id: "size-s", size: "S", stock: 7, expectedStock: 7 },
    { id: "size-m", size: "M", stock: 4, expectedStock: 4 },
    { size: "xl", stock: 6 },
  ]);

  assert.ok(
    plan.updates.some(
      (size) => size.id === "size-old" && size.active && size.stock === 6,
    ),
  );
  assert.deepEqual(plan.creates, []);
});

test("novi naziv bez postojećeg reda pravi samo novi ID", () => {
  const plan = planProductSizeSync(existing, [
    { id: "size-s", size: "S", stock: 7, expectedStock: 7 },
    { id: "size-m", size: "M", stock: 4, expectedStock: 4 },
    { size: "L", stock: 2 },
  ]);

  assert.deepEqual(plan.creates, [{ size: "L", stock: 2, active: true }]);
  assert.deepEqual(plan.retireIds, []);
});

test("ID drugog proizvoda i duplikati se odbijaju", () => {
  assert.throws(
    () =>
      planProductSizeSync(existing, [
        { id: "foreign-size", size: "S", stock: 1, expectedStock: 7 },
      ]),
    (error: unknown) =>
      error instanceof ProductSizeSyncError &&
      error.code === "PRODUCT_SIZE_ID_MISMATCH",
  );

  assert.throws(
    () =>
      planProductSizeSync(existing, [
        { id: "size-s", size: "M", stock: 1, expectedStock: 7 },
        { id: "size-m", size: "m", stock: 2, expectedStock: 4 },
      ]),
    (error: unknown) =>
      error instanceof ProductSizeSyncError &&
      error.code === "DUPLICATE_PRODUCT_SIZE",
  );

  assert.throws(
    () =>
      planProductSizeSync(existing, [
        { id: "size-s", size: "XL", stock: 1, expectedStock: 7 },
        { id: "size-m", size: "M", stock: 2, expectedStock: 4 },
      ]),
    (error: unknown) =>
      error instanceof ProductSizeSyncError &&
      error.code === "PRODUCT_SIZE_NAME_CONFLICT",
  );
});

test("stari admin stock ne može da prepiše paralelnu rezervaciju ili povrat", () => {
  assert.throws(
    () =>
      planProductSizeSync(
        [{ id: "size-s", size: "S", stock: 6, active: true }],
        [{ id: "size-s", size: "S", stock: 5, expectedStock: 5 }],
      ),
    (error: unknown) =>
      error instanceof ProductSizeSyncError &&
      error.code === "PRODUCT_SIZE_STALE_STOCK" &&
      error.status === 409,
  );

  assert.throws(
    () =>
      planProductSizeSync(existing, [
        { id: "size-s", size: "S", stock: 7 },
      ]),
    (error: unknown) =>
      error instanceof ProductSizeSyncError &&
      error.code === "PRODUCT_SIZE_VERSION_REQUIRED",
  );
});

test("reaktivacija sabira novu robu sa povratom na povučenom redu", () => {
  const plan = planProductSizeSync(
    [{ id: "size-old", size: "XL", stock: 2, active: false }],
    [{ size: "XL", stock: 6 }],
  );

  assert.deepEqual(plan.updates, [
    { id: "size-old", size: "XL", stock: 8, active: true },
  ]);
});

test("shared inventory lock zaključava jedinstvene proizvode sortiranim redom", async () => {
  const lockOrder: string[] = [];
  const tx = {
    $queryRaw: async (_query: TemplateStringsArray, productId: string) => {
      lockOrder.push(productId);
      return [{ id: productId }];
    },
  } as unknown as Parameters<typeof lockProductInventoryRows>[0];

  const locked = await lockProductInventoryRows(tx, ["product-b", "product-a", "product-b"]);

  assert.deepEqual(lockOrder, ["product-a", "product-b"]);
  assert.deepEqual([...locked], ["product-a", "product-b"]);
});

test("negativna i decimalna zaliha se odbijaju", () => {
  for (const stock of [-1, 1.5]) {
    assert.throws(
      () => planProductSizeSync(existing, [{ size: "L", stock }]),
      ProductSizeSyncError,
    );
  }
});

test("aktivan proizvod fail-closed zahteva bar jedan stock red", () => {
  assert.throws(
    () => assertActiveProductHasInventory(true, 0),
    (error: unknown) =>
      error instanceof ProductSizeSyncError &&
      error.code === "ACTIVE_PRODUCT_REQUIRES_INVENTORY" &&
      error.status === 409,
  );
  assert.doesNotThrow(() => assertActiveProductHasInventory(true, 1));
  assert.doesNotThrow(() => assertActiveProductHasInventory(false, 0));
});

test("izostavljen active zadržava postojeći status pre inventory provere", () => {
  assert.equal(resolveDesiredProductActive(true, undefined), true);
  assert.equal(resolveDesiredProductActive(false, undefined), false);
  assert.equal(resolveDesiredProductActive(false, true), true);
  assert.equal(resolveDesiredProductActive(true, false), false);
  assert.throws(
    () => resolveDesiredProductActive(true, "false"),
    (error: unknown) =>
      error instanceof ProductSizeSyncError &&
      error.code === "INVALID_PRODUCT_STATUS",
  );
});
