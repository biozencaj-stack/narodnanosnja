/**
 * Stable server-side identity contract used while session enforcement moves
 * behind one resolver. The implementation is intentionally selected in a
 * separate module so a cutover cannot silently combine two credential sources.
 */
export interface ServerSessionPrincipal {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: "CUSTOMER" | "OPERATOR" | "ADMIN";
  requiresEmailVerification: boolean;
}

export type ServerSessionResolution =
  | Readonly<{
      status: "authenticated";
      principal: Readonly<ServerSessionPrincipal>;
    }>
  | Readonly<{
      status: "anonymous";
    }>
  | Readonly<{
      status: "unavailable";
    }>;

export const ANONYMOUS_SERVER_SESSION = Object.freeze({
  status: "anonymous" as const,
});

export const UNAVAILABLE_SERVER_SESSION = Object.freeze({
  status: "unavailable" as const,
});
