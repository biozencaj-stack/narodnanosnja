export const ADMIN_ROLES = ["ADMIN", "OPERATOR"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export type AdminAccessDenialReason =
  | "UNAUTHENTICATED"
  | "NOT_ADMIN_STAFF"
  | "OPERATOR_SCOPE";

export type AdminAccessDecision =
  | { allowed: true; role: AdminRole }
  | { allowed: false; reason: AdminAccessDenialReason };

type OperatorApiRule = {
  pathname: string;
  methods: readonly string[];
  match: "exact" | "order-status";
};

type OperatorPageRule = {
  pathname: string;
  match: "exact" | "subtree";
};

/**
 * OPERATOR access is deny-by-default. Keep every exception in this file so the
 * proxy, server layout and tests use one authorization policy.
 */
export const OPERATOR_PAGE_PATHS: readonly OperatorPageRule[] = [
  { pathname: "/admin/orders", match: "subtree" },
  { pathname: "/admin/chat/poruke", match: "subtree" },
];

export const OPERATOR_API_RULES: readonly OperatorApiRule[] = [
  {
    pathname: "/api/admin/orders/:id/status",
    methods: ["PUT"],
    match: "order-status",
  },
  {
    pathname: "/api/admin/chat/messages",
    methods: ["GET", "PUT"],
    match: "exact",
  },
];

function withoutTrailingSlash(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function isExactOrSubtree(pathname: string, basePath: string) {
  const normalizedPathname = withoutTrailingSlash(pathname);
  return (
    normalizedPathname === basePath ||
    normalizedPathname.startsWith(`${basePath}/`)
  );
}

export function isAdminRole(role: unknown): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}

export function isAdminPagePath(pathname: string) {
  return isExactOrSubtree(pathname, "/admin");
}

export function isAdminApiPath(pathname: string) {
  return isExactOrSubtree(pathname, "/api/admin");
}

function operatorCanAccessPage(pathname: string) {
  const normalizedPathname = withoutTrailingSlash(pathname);

  return OPERATOR_PAGE_PATHS.some((rule) =>
    rule.match === "exact"
      ? normalizedPathname === rule.pathname
      : isExactOrSubtree(normalizedPathname, rule.pathname)
  );
}

function operatorCanAccessApi(pathname: string, method: string) {
  const normalizedPathname = withoutTrailingSlash(pathname);
  const normalizedMethod = method.toUpperCase();

  return OPERATOR_API_RULES.some((rule) => {
    if (!rule.methods.includes(normalizedMethod)) {
      return false;
    }

    if (rule.match === "exact") {
      return normalizedPathname === rule.pathname;
    }

    const segments = normalizedPathname.split("/").filter(Boolean);
    return (
      segments.length === 5 &&
      segments[0] === "api" &&
      segments[1] === "admin" &&
      segments[2] === "orders" &&
      segments[3].length > 0 &&
      segments[4] === "status"
    );
  });
}

function decideForRole(
  role: unknown,
  operatorAllowed: boolean
): AdminAccessDecision {
  if (!role) {
    return { allowed: false, reason: "UNAUTHENTICATED" };
  }

  if (!isAdminRole(role)) {
    return { allowed: false, reason: "NOT_ADMIN_STAFF" };
  }

  if (role === "ADMIN" || operatorAllowed) {
    return { allowed: true, role };
  }

  return { allowed: false, reason: "OPERATOR_SCOPE" };
}

export function getAdminPageAccess(
  role: unknown,
  pathname: string
): AdminAccessDecision {
  return decideForRole(role, operatorCanAccessPage(pathname));
}

export function getAdminApiAccess(
  role: unknown,
  pathname: string,
  method: string
): AdminAccessDecision {
  return decideForRole(role, operatorCanAccessApi(pathname, method));
}
