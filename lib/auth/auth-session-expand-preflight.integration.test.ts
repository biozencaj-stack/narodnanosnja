import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

const RUN_DATABASE_TESTS =
  process.env.RUN_AUTH_SESSION_EXPAND_PREFLIGHT_DB_TESTS === "true";
const PREFLIGHT_PATH = path.join(
  process.cwd(),
  "scripts/auth-session-expand-preflight.sql",
);

type TestEnvironment = Readonly<Record<string, string | undefined>>;

function assertSafeTestDatabase(
  environment: TestEnvironment = process.env,
): string {
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL je obavezan za auth session expand preflight test.",
    );
  }
  if (databaseUrl.trim() !== databaseUrl) {
    throw new Error("DATABASE_URL ne sme imati okolne razmake.");
  }

  let prismaUrl: URL;
  try {
    prismaUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nije validna URL adresa.");
  }
  if (!['postgres:', 'postgresql:'].includes(prismaUrl.protocol)) {
    throw new Error("Preflight test zahteva PostgreSQL DATABASE_URL.");
  }
  if (
    !['127.0.0.1', 'localhost', '::1', '[::1]'].includes(
      prismaUrl.hostname.toLowerCase(),
    )
  ) {
    throw new Error("Preflight test zahteva loopback PostgreSQL host.");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(prismaUrl.pathname.replace(/^\/+/, ""));
  } catch {
    throw new Error("Naziv test baze nije validno kodiran.");
  }
  if (
    !databaseName ||
    databaseName.includes("/") ||
    !/(?:^|[_-])(?:e2e|test|provera)(?:$|[_-])/i.test(databaseName) ||
    /(?:^|[_-])(?:prod|production|live)(?:$|[_-])/i.test(databaseName)
  ) {
    throw new Error("Preflight test je odbijen: nije bezbedna test baza.");
  }

  const prismaParameters = [...prismaUrl.searchParams.entries()];
  if (
    prismaParameters.length > 1 ||
    (prismaParameters.length === 1 &&
      (prismaParameters[0]?.[0] !== "schema" ||
        prismaParameters[0]?.[1] !== "public")) ||
    prismaUrl.hash
  ) {
    throw new Error(
      "DATABASE_URL može imati samo Prisma schema=public parametar.",
    );
  }

  const configuredPsqlUrl = environment.PSQL_DATABASE_URL;
  const usesExplicitPsqlUrl = configuredPsqlUrl !== undefined;
  if (usesExplicitPsqlUrl && configuredPsqlUrl.trim() !== configuredPsqlUrl) {
    throw new Error("PSQL_DATABASE_URL ne sme imati okolne razmake.");
  }
  let psqlUrl: URL;
  try {
    psqlUrl = new URL(usesExplicitPsqlUrl ? configuredPsqlUrl : databaseUrl);
  } catch {
    throw new Error("PSQL_DATABASE_URL nije validna URL adresa.");
  }
  if (usesExplicitPsqlUrl && (psqlUrl.search || psqlUrl.hash)) {
    throw new Error("PSQL_DATABASE_URL ne sme imati query ili fragment.");
  }
  if (
    psqlUrl.protocol !== prismaUrl.protocol ||
    psqlUrl.hostname !== prismaUrl.hostname ||
    psqlUrl.port !== prismaUrl.port ||
    psqlUrl.pathname !== prismaUrl.pathname ||
    psqlUrl.username !== prismaUrl.username
  ) {
    throw new Error("PSQL_DATABASE_URL mora ciljati istu test bazu.");
  }
  psqlUrl.search = "";
  psqlUrl.hash = "";
  return psqlUrl.toString();
}

function assertSafeSchemaName(value: string): string {
  if (!/^auth_session_expand_[a-f0-9]{32}$/.test(value)) {
    throw new Error("Refusing an unsafe generated test schema name.");
  }
  return value;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function runPreflight(databaseUrl: string, schemaName: string) {
  return spawnSync(
    "psql",
    [
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      `session_schema=${schemaName}`,
      "-f",
      PREFLIGHT_PATH,
      databaseUrl,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, PSQLRC: "/dev/null" },
    },
  );
}

function aggregateLines(output: string): string[] {
  return output
    .split(/\r?\n/)
    .filter((line) => line.startsWith("preflight."));
}

test("auth session expand preflight accepts only the CI Prisma URL form", () => {
  const databaseUrl = "postgresql://provera:provera@127.0.0.1:5432/provera?schema=public";
  assert.equal(
    assertSafeTestDatabase({ DATABASE_URL: databaseUrl }),
    "postgresql://provera:provera@127.0.0.1:5432/provera",
  );
  assert.equal(
    assertSafeTestDatabase({
      DATABASE_URL: databaseUrl,
      PSQL_DATABASE_URL: "postgresql://provera:provera@127.0.0.1:5432/provera",
    }),
    "postgresql://provera:provera@127.0.0.1:5432/provera",
  );
  for (const unsafeUrl of [
    "postgresql://provera:provera@127.0.0.1:5432/provera?schema=other",
    "postgresql://provera:provera@127.0.0.1:5432/provera?schema=public&sslmode=require",
  ]) {
    assert.throws(
      () => assertSafeTestDatabase({ DATABASE_URL: unsafeUrl }),
      /DATABASE_URL može imati samo Prisma schema=public parametar/,
    );
  }
});

test(
  "auth session expand preflight: clean baseline succeeds and reserved legacy digest fails closed",
  { skip: !RUN_DATABASE_TESTS, timeout: 45_000 },
  async (testContext) => {
    const databaseUrl = assertSafeTestDatabase();
    const schemaName = assertSafeSchemaName(
      `auth_session_expand_${randomUUID().replaceAll("-", "")}`,
    );
    const quotedSchema = quoteIdentifier(schemaName);
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();

    testContext.after(async () => {
      try {
        await prisma.$executeRawUnsafe(
          `DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`,
        );
      } finally {
        await prisma.$disconnect();
      }
    });

    await prisma.$executeRawUnsafe(`CREATE SCHEMA ${quotedSchema}`);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE ${quotedSchema}."Session" (
        "id" TEXT PRIMARY KEY,
        "sessionToken" TEXT NOT NULL UNIQUE,
        "expires" TIMESTAMP(3) NOT NULL
      )
    `);
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${quotedSchema}."Session" ("id", "sessionToken", "expires")
       VALUES ($1, $2, TIMESTAMP '2099-01-01 00:00:00')`,
      "clean-session",
      "legacy-token-not-reserved",
    );

    const clean = runPreflight(databaseUrl, schemaName);
    assert.equal(clean.error, undefined);
    assert.equal(clean.status, 0);
    assert.deepEqual(aggregateLines(clean.stdout), [
      "preflight.session.legacy_reserved_v1_token|0",
    ]);
    assert.equal(clean.stdout.includes("clean-session"), false);
    assert.equal(clean.stderr.includes("clean-session"), false);

    const reservedToken = `v1:${"a".repeat(64)}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO ${quotedSchema}."Session" ("id", "sessionToken", "expires")
       VALUES ($1, $2, TIMESTAMP '2000-01-01 00:00:00')`,
      "expired-reserved-session",
      reservedToken,
    );

    const collision = runPreflight(databaseUrl, schemaName);
    assert.equal(collision.error, undefined);
    assert.equal(collision.status, 3);
    assert.deepEqual(aggregateLines(collision.stdout), [
      "preflight.session.legacy_reserved_v1_token|1",
    ]);
    assert.match(
      collision.stderr,
      /Auth session expand preflight found reserved legacy Session token shape/,
    );
    for (const privateValue of [
      "expired-reserved-session",
      reservedToken,
    ]) {
      assert.equal(collision.stdout.includes(privateValue), false);
      assert.equal(collision.stderr.includes(privateValue), false);
    }
  },
);
