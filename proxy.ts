import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  getAdminApiAccess,
  getAdminPageAccess,
  isAdminApiPath,
  isAdminPagePath,
} from "@/lib/auth/admin-policy";
import { isTrustedWriteRequest } from "@/lib/security/origin";

// Paths that require authentication
const protectedPaths = ["/moj-nalog"];

// Paths that should redirect to home if already authenticated
const authPaths = ["/login", "/register"];

const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // DEMO_MODE: block all write requests to API except auth (login/signout) and health
  if (process.env.DEMO_MODE === "true") {
    if (WRITE_METHODS.includes(request.method)) {
      if (pathname.includes("/health")) {
        return NextResponse.next();
      }
      if (pathname.startsWith("/api/auth/register")) {
        return NextResponse.json(
          { error: "Demo režim – upis je onemogućen." },
          { status: 403 }
        );
      }
      if (pathname.startsWith("/api/auth/")) {
        return NextResponse.next();
      }
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { error: "Demo režim – upis je onemogućen." },
          { status: 403 }
        );
      }
    }
  }

  // Get the token
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Check if trying to access auth pages while logged in
  if (authPaths.some((path) => pathname.startsWith(path))) {
    if (token) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Admin API authorization is deny-by-default for every role except ADMIN.
  // Return JSON responses here so direct API attempts cannot fall through to a
  // route with a missing or overly broad local role check.
  if (isAdminApiPath(pathname)) {
    const access = getAdminApiAccess(token?.role, pathname, request.method);

    if (!access.allowed) {
      const unauthenticated = access.reason === "UNAUTHENTICATED";
      return NextResponse.json(
        {
          error: unauthenticated
            ? "Prijava je obavezna."
            : "Nemate dozvolu za ovu administrativnu akciju.",
        },
        { status: unauthenticated ? 401 : 403 }
      );
    }
  }

  // Page authorization uses the same policy as the API. An OPERATOR who opens
  // an ADMIN-only URL is returned to their permitted orders workspace.
  if (isAdminPagePath(pathname)) {
    const access = getAdminPageAccess(token?.role, pathname);

    if (!access.allowed) {
      if (access.reason === "UNAUTHENTICATED") {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set(
          "callbackUrl",
          `${pathname}${request.nextUrl.search}`
        );
        return NextResponse.redirect(loginUrl);
      }

      if (access.reason === "OPERATOR_SCOPE") {
        return NextResponse.redirect(new URL("/admin/orders", request.url));
      }

      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  // Check if trying to access protected paths
  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );

  if (isProtectedPath) {
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

  }

  // CSRF protection for API routes (except NextAuth and NestPay callbacks)
  // NestPay callbacks must be publicly accessible - they receive POST from NestPay servers
  const isNestPayCallback = pathname.startsWith("/api/payments/nestpay/callback/");

  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/") &&
    !isNestPayCallback &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)
  ) {
    if (!isTrustedWriteRequest(request.headers)) {
      return NextResponse.json(
        { error: "CSRF validation failed" },
        { status: 403 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|images|logo).*)",
  ],
};
