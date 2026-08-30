import {
  ANONYMOUS_SERVER_SESSION,
  UNAVAILABLE_SERVER_SESSION,
  type ServerSessionPrincipal,
  type ServerSessionResolution,
} from "./server-session-contract";

export interface LegacyServerSessionReport {
  stage: "LEGACY_SESSION_READ" | "LEGACY_SESSION_SHAPE";
}

export interface LegacyServerSessionDependencies {
  read: () => Promise<unknown>;
  report?: (event: LegacyServerSessionReport) => void | Promise<unknown>;
}

function safelyReport(
  dependencies: LegacyServerSessionDependencies,
  stage: LegacyServerSessionReport["stage"],
): void {
  try {
    const reporter = dependencies.report;
    void Promise.resolve(reporter?.({ stage })).catch(() => {});
  } catch {
    // Observability must never change the fail-closed session result.
  }
}

function isSafePrincipalString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

const INVALID_PROPERTY = Symbol("INVALID_PROPERTY");

function readOwnDataProperty(
  value: object,
  property: string,
): unknown | typeof INVALID_PROPERTY {
  const descriptor = Object.getOwnPropertyDescriptor(value, property);
  if (!descriptor || !("value" in descriptor)) return INVALID_PROPERTY;
  return descriptor.value;
}

function projectLegacyPrincipal(
  value: unknown,
): Readonly<ServerSessionPrincipal> | null {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const rawUser = readOwnDataProperty(value, "user");
    if (
      rawUser === INVALID_PROPERTY ||
      rawUser === null ||
      typeof rawUser !== "object" ||
      Array.isArray(rawUser)
    ) {
      return null;
    }

    // Accept only own data properties. Accessors and inherited values are
    // rejected without executing them, and every Proxy trap is inside this
    // fail-closed boundary.
    const id = readOwnDataProperty(rawUser, "id");
    const email = readOwnDataProperty(rawUser, "email");
    const firstName = readOwnDataProperty(rawUser, "firstName");
    const lastName = readOwnDataProperty(rawUser, "lastName");
    const role = readOwnDataProperty(rawUser, "role");
    const requiresEmailVerification = readOwnDataProperty(
      rawUser,
      "requiresEmailVerification",
    );

    if (
      !isSafePrincipalString(id) ||
      !isSafePrincipalString(email) ||
      !isSafePrincipalString(firstName) ||
      !isSafePrincipalString(lastName) ||
      !["CUSTOMER", "OPERATOR", "ADMIN"].includes(
        typeof role === "string" ? role : "",
      ) ||
      typeof requiresEmailVerification !== "boolean"
    ) {
      return null;
    }

    return Object.freeze({
      id,
      email,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
      role: role as ServerSessionPrincipal["role"],
      requiresEmailVerification,
    });
  } catch {
    return null;
  }
}

/**
 * Transitional legacy-only adapter. It must be deleted at the V2 cutover,
 * never retained as a fallback for a missing, invalid or revoked V2 session.
 */
export function createLegacyServerSessionResolver(
  dependencies: LegacyServerSessionDependencies,
) {
  return {
    async resolve(): Promise<ServerSessionResolution> {
      let legacySession: unknown;
      try {
        legacySession = await dependencies.read();
      } catch {
        safelyReport(dependencies, "LEGACY_SESSION_READ");
        return UNAVAILABLE_SERVER_SESSION;
      }

      if (legacySession === null) return ANONYMOUS_SERVER_SESSION;

      const principal = projectLegacyPrincipal(legacySession);
      if (!principal) {
        safelyReport(dependencies, "LEGACY_SESSION_SHAPE");
        return UNAVAILABLE_SERVER_SESSION;
      }

      return Object.freeze({
        status: "authenticated" as const,
        principal,
      });
    },
  };
}
