import assert from "node:assert/strict";
import test from "node:test";
import { requireSafeDemoSeedTarget } from "./demo-seed-safety";

test("demo seed zahteva eksplicitan opt-in pre razmatranja baze", () => {
  for (const optIn of [undefined, "", "false", "TRUE", " true"]) {
    assert.throws(
      () =>
        requireSafeDemoSeedTarget({
          DATABASE_URL: "postgresql://user:secret@db.example/demo_test",
          DEMO_DATABASE_SEED: optIn,
        }),
      /DEMO_DATABASE_SEED=true/,
    );
  }
});

test("demo seed prihvata samo jasno označenu PostgreSQL bazu", () => {
  for (const databaseName of [
    "shop_demo",
    "demo-shop",
    "shop_e2e",
    "shop-test-01",
    "provera_shop",
  ]) {
    assert.equal(
      requireSafeDemoSeedTarget({
        DATABASE_URL: `postgresql://user:secret@db.example/${databaseName}`,
        DEMO_DATABASE_SEED: "true",
      }),
      databaseName,
    );
  }
});

test("demo seed odbija obične i produkcione nazive bez otkrivanja URL-a", () => {
  for (const databaseName of [
    "shop",
    "shop_prod",
    "shop_demo_prod2",
    "production2_demo",
    "live2-demo",
    "prodbackup_demo",
    "production-demo",
    "demo-live",
    "shop/demo",
  ]) {
    assert.throws(
      () =>
        requireSafeDemoSeedTarget({
          DATABASE_URL: `postgresql://user:secret@db.example/${databaseName}`,
          DEMO_DATABASE_SEED: "true",
        }),
      (error) =>
        error instanceof Error &&
        !error.message.includes("secret") &&
        !error.message.includes("db.example"),
    );
  }
});

test("demo seed odbija pogrešan protokol, whitespace i nevalidan URL", () => {
  for (const databaseUrl of [
    "mysql://user:secret@db.example/shop_demo",
    "postgresql://user:secret@db.example/shop_demo ",
    "nije-url",
  ]) {
    assert.throws(() =>
      requireSafeDemoSeedTarget({
        DATABASE_URL: databaseUrl,
        DEMO_DATABASE_SEED: "true",
      }),
    );
  }
});
