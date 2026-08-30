const SAFE_DEMO_DATABASE_MARKER =
  /(?:^|[_-])(?:demo|e2e|test|provera)(?:$|[_-])/i;
const FORBIDDEN_DATABASE_MARKER = /prod|production|live/i;

export interface DemoSeedEnvironment {
  [key: string]: string | undefined;
  DATABASE_URL?: string;
  DEMO_DATABASE_SEED?: string;
}

/**
 * Demo fixtures intentionally contain public, shared credentials. Requiring an
 * explicit one-shot opt-in and a visibly non-production database name keeps a
 * routine demo refresh from silently replacing real account credentials.
 */
export function requireSafeDemoSeedTarget(
  environment: DemoSeedEnvironment,
): string {
  if (environment.DEMO_DATABASE_SEED !== "true") {
    throw new Error(
      "Demo seed je dozvoljen samo uz DEMO_DATABASE_SEED=true.",
    );
  }

  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl || databaseUrl.trim() !== databaseUrl) {
    throw new Error("DATABASE_URL je obavezan za demo seed.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL nije validna URL adresa.");
  }
  if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
    throw new Error("Demo seed zahteva PostgreSQL bazu.");
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(
      parsedUrl.pathname.replace(/^\/+/, ""),
    );
  } catch {
    throw new Error("Naziv demo baze nije validan.");
  }

  if (
    !databaseName ||
    databaseName.includes("/") ||
    !SAFE_DEMO_DATABASE_MARKER.test(databaseName) ||
    FORBIDDEN_DATABASE_MARKER.test(databaseName)
  ) {
    throw new Error(
      "Demo seed je odbijen: naziv baze mora jasno sadržati demo, e2e, test ili provera i ne sme sadržati prod, production ili live.",
    );
  }

  return databaseName;
}
