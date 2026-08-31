import type { ServerSessionResolution } from "../auth/server-session-contract";

export const WISHLIST_UNAVAILABLE_MESSAGE =
  "Zahtev trenutno nije moguće obraditi. Pokušajte ponovo.";

export const WISHLIST_PRIVATE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});

export type WishlistMethod = "GET" | "POST" | "DELETE";
export type WishlistFailureStage = "SESSION" | "BODY" | "DATABASE";

export interface WishlistFailure {
  method: WishlistMethod;
  stage: WishlistFailureStage;
}

export interface WishlistItemRecord {
  productId: string | null;
}

interface WishlistSessionDependencies {
  resolveSession: () => Promise<ServerSessionResolution>;
  reportFailure: (
    failure: Readonly<WishlistFailure>,
  ) => void | Promise<unknown>;
}

export interface WishlistGetHandlerDependencies
  extends WishlistSessionDependencies {
  findItemsByUserId: (
    userId: string,
  ) => Promise<readonly WishlistItemRecord[]>;
}

export interface WishlistPostHandlerDependencies
  extends WishlistSessionDependencies {
  upsertItem: (userId: string, productId: unknown) => Promise<unknown>;
}

export interface WishlistDeleteHandlerDependencies
  extends WishlistSessionDependencies {
  deleteItems: (userId: string, productId: unknown) => Promise<unknown>;
}

type AuthenticationResult =
  | Readonly<{
      status: "authenticated";
      userId: string;
    }>
  | Readonly<{
      status: "response";
      response: Response;
    }>;

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: WISHLIST_PRIVATE_HEADERS,
  });
}

function safelyReportFailure(
  reportFailure: WishlistSessionDependencies["reportFailure"],
  method: WishlistMethod,
  stage: WishlistFailureStage,
): void {
  try {
    const report = reportFailure(Object.freeze({ method, stage }));
    void Promise.resolve(report).catch(() => undefined);
  } catch {
    // Observability must never replace the fail-closed private response.
  }
}

function unavailableResponse(): Response {
  return jsonResponse(
    { success: false, error: WISHLIST_UNAVAILABLE_MESSAGE },
    503,
  );
}

async function authenticate(
  dependencies: WishlistSessionDependencies,
  method: WishlistMethod,
): Promise<AuthenticationResult> {
  try {
    const resolution = await dependencies.resolveSession();
    const status = resolution.status;
    if (status === "anonymous") {
      return Object.freeze({
        status: "response",
        response: jsonResponse(
          { success: false, error: "Morate biti prijavljeni" },
          401,
        ),
      });
    }
    if (status === "unavailable") {
      return Object.freeze({
        status: "response",
        response: unavailableResponse(),
      });
    }
    if (status !== "authenticated") {
      throw new TypeError("Invalid server session resolution");
    }
    const principal = resolution.principal;
    if (typeof principal !== "object" || principal === null) {
      throw new TypeError("Invalid server session principal");
    }
    const userId = principal.id;
    if (typeof userId !== "string" || userId.length === 0) {
      throw new TypeError("Invalid server session principal");
    }
    return Object.freeze({
      status: "authenticated",
      userId,
    });
  } catch {
    safelyReportFailure(dependencies.reportFailure, method, "SESSION");
    return Object.freeze({
      status: "response",
      response: unavailableResponse(),
    });
  }
}

async function readProductId(
  request: Request,
  dependencies: WishlistSessionDependencies,
  method: "POST" | "DELETE",
  errorMessage: string,
): Promise<
  | Readonly<{ status: "value"; productId: unknown }>
  | Readonly<{ status: "response"; response: Response }>
> {
  let productId: unknown;
  try {
    ({ productId } = (await request.json()) as { productId?: unknown });
  } catch {
    safelyReportFailure(dependencies.reportFailure, method, "BODY");
    return Object.freeze({
      status: "response",
      response: jsonResponse({ success: false, error: errorMessage }, 500),
    });
  }

  if (!productId) {
    return Object.freeze({
      status: "response",
      response: jsonResponse(
        { success: false, error: "Product ID je obavezan" },
        400,
      ),
    });
  }
  return Object.freeze({ status: "value", productId });
}

export function createWishlistGetHandler(
  dependencies: WishlistGetHandlerDependencies,
) {
  return async function GET(): Promise<Response> {
    const authentication = await authenticate(dependencies, "GET");
    if (authentication.status === "response") {
      return authentication.response;
    }

    try {
      const items = await dependencies.findItemsByUserId(
        authentication.userId,
      );
      if (!Array.isArray(items)) {
        throw new TypeError("Invalid wishlist collection projection");
      }
      const productIds: Array<string | null> = [];
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        if (typeof item !== "object" || item === null) {
          throw new TypeError("Invalid wishlist item projection");
        }
        const productId = item.productId;
        if (!(typeof productId === "string" || productId === null)) {
          throw new TypeError("Invalid wishlist product id projection");
        }
        productIds.push(productId);
      }
      return jsonResponse({ success: true, data: productIds }, 200);
    } catch {
      safelyReportFailure(dependencies.reportFailure, "GET", "DATABASE");
      return jsonResponse(
        { success: false, error: "Greška pri učitavanju liste želja" },
        500,
      );
    }
  };
}

export function createWishlistPostHandler(
  dependencies: WishlistPostHandlerDependencies,
) {
  return async function POST(request: Request): Promise<Response> {
    const authentication = await authenticate(dependencies, "POST");
    if (authentication.status === "response") {
      return authentication.response;
    }

    const parsed = await readProductId(
      request,
      dependencies,
      "POST",
      "Greška pri dodavanju u listu želja",
    );
    if (parsed.status === "response") return parsed.response;

    try {
      await dependencies.upsertItem(
        authentication.userId,
        parsed.productId,
      );
      return jsonResponse(
        { success: true, message: "Proizvod dodat u listu želja" },
        200,
      );
    } catch {
      safelyReportFailure(dependencies.reportFailure, "POST", "DATABASE");
      return jsonResponse(
        { success: false, error: "Greška pri dodavanju u listu želja" },
        500,
      );
    }
  };
}

export function createWishlistDeleteHandler(
  dependencies: WishlistDeleteHandlerDependencies,
) {
  return async function DELETE(request: Request): Promise<Response> {
    const authentication = await authenticate(dependencies, "DELETE");
    if (authentication.status === "response") {
      return authentication.response;
    }

    const parsed = await readProductId(
      request,
      dependencies,
      "DELETE",
      "Greška pri uklanjanju iz liste želja",
    );
    if (parsed.status === "response") return parsed.response;

    try {
      await dependencies.deleteItems(
        authentication.userId,
        parsed.productId,
      );
      return jsonResponse(
        { success: true, message: "Proizvod uklonjen iz liste želja" },
        200,
      );
    } catch {
      safelyReportFailure(
        dependencies.reportFailure,
        "DELETE",
        "DATABASE",
      );
      return jsonResponse(
        { success: false, error: "Greška pri uklanjanju iz liste želja" },
        500,
      );
    }
  };
}
