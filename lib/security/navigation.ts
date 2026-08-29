const INTERNAL_URL_BASE = "https://internal.invalid";
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;
const ENCODED_UNSAFE_PATH_BYTE = /%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i;

/**
 * Converts an untrusted login callback into a canonical same-origin path.
 * Only root-relative paths within this storefront are accepted; URL schemes,
 * protocol-relative URLs and ambiguous path separators fail closed.
 */
export function safeLoginCallbackPath(value: string | null): string {
  if (!value || value !== value.trim()) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";

  const pathEnd = value.search(/[?#]/);
  const rawPath = pathEnd === -1 ? value : value.slice(0, pathEnd);
  if (ENCODED_UNSAFE_PATH_BYTE.test(rawPath)) return "/";

  try {
    const decodedPath = decodeURIComponent(rawPath);
    const pathSegments = decodedPath.split("/");

    if (CONTROL_OR_BACKSLASH.test(decodedPath)) return "/";
    if (decodedPath !== "/" && decodedPath.includes("//")) return "/";
    if (pathSegments.some((segment) => segment === "." || segment === "..")) {
      return "/";
    }
  } catch {
    return "/";
  }

  try {
    const parsed = new URL(value, INTERNAL_URL_BASE);
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (parsed.origin !== INTERNAL_URL_BASE) return "/";
    if (!normalized.startsWith("/") || normalized.startsWith("//")) return "/";
    return normalized;
  } catch {
    return "/";
  }
}
