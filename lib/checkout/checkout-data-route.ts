import type { ServerSessionResolution } from "../auth/server-session-contract";

export const CHECKOUT_DATA_UNAVAILABLE_MESSAGE =
  "Zahtev trenutno nije moguće obraditi. Pokušajte ponovo.";

export const CHECKOUT_DATA_PRIVATE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});

export interface CheckoutDataAddress {
  street: string;
  apartment: string | null;
  city: string;
  postalCode: string;
  country: string;
}

export interface CheckoutDataRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  addresses: readonly CheckoutDataAddress[];
}

export type CheckoutDataFailureStage = "SESSION" | "LOOKUP";

export interface CheckoutDataFailure {
  stage: CheckoutDataFailureStage;
}

export interface CheckoutDataHandlerDependencies {
  resolveSession: () => Promise<ServerSessionResolution>;
  findUserById: (userId: string) => Promise<CheckoutDataRecord | null>;
  reportFailure: (
    failure: Readonly<CheckoutDataFailure>,
  ) => void | Promise<unknown>;
}

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: CHECKOUT_DATA_PRIVATE_HEADERS,
  });
}

function safelyReportFailure(
  reportFailure: CheckoutDataHandlerDependencies["reportFailure"],
  stage: CheckoutDataFailureStage,
): void {
  try {
    const report = reportFailure(Object.freeze({ stage }));
    void Promise.resolve(report).catch(() => undefined);
  } catch {
    // Observability must never replace the fail-closed private response.
  }
}

function unavailableResponse(): Response {
  return jsonResponse({ error: CHECKOUT_DATA_UNAVAILABLE_MESSAGE }, 503);
}

export function createCheckoutDataGetHandler(
  dependencies: CheckoutDataHandlerDependencies,
) {
  return async function GET(): Promise<Response> {
    let userId: string;
    try {
      const resolution = await dependencies.resolveSession();
      if (resolution.status === "anonymous") {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      if (resolution.status === "unavailable") {
        return unavailableResponse();
      }
      if (
        resolution.status !== "authenticated" ||
        typeof resolution.principal !== "object" ||
        resolution.principal === null ||
        typeof resolution.principal.id !== "string" ||
        resolution.principal.id.length === 0
      ) {
        throw new TypeError("Invalid server session resolution");
      }
      userId = resolution.principal.id;
    } catch {
      safelyReportFailure(dependencies.reportFailure, "SESSION");
      return unavailableResponse();
    }

    try {
      const user = await dependencies.findUserById(userId);
      if (!user) {
        return jsonResponse({ error: "User not found" }, 404);
      }
      const address = user.addresses[0];
      const defaultAddress = address
        ? {
            street: address.street,
            apartment: address.apartment,
            city: address.city,
            postalCode: address.postalCode,
            country: address.country,
          }
        : null;

      return jsonResponse(
        {
          user: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
          },
          defaultAddress,
        },
        200,
      );
    } catch {
      safelyReportFailure(dependencies.reportFailure, "LOOKUP");
      return jsonResponse({ error: "Internal server error" }, 500);
    }
  };
}
