const INTERNAL_URL_BASE = "https://internal.invalid";
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;
const ENCODED_UNSAFE_PATH_BYTE = /%(?:0[0-9a-f]|1[0-9a-f]|2f|5c|7f)/i;
const FRAGMENT_ONLY = /^#[A-Za-z][A-Za-z0-9_-]{0,63}$/;

/**
 * Shared canonicalization for untrusted root-relative paths. Returns `null`
 * when the value is not a safe same-origin path, so each caller can pick its
 * own fallback.
 */
function canonicalInternalPath(value: string | null): string | null {
  if (!value || value !== value.trim()) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;

  const pathEnd = value.search(/[?#]/);
  const rawPath = pathEnd === -1 ? value : value.slice(0, pathEnd);
  if (ENCODED_UNSAFE_PATH_BYTE.test(rawPath)) return null;

  try {
    const decodedPath = decodeURIComponent(rawPath);
    const pathSegments = decodedPath.split("/");

    if (CONTROL_OR_BACKSLASH.test(decodedPath)) return null;
    if (decodedPath !== "/" && decodedPath.includes("//")) return null;
    if (pathSegments.some((segment) => segment === "." || segment === "..")) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = new URL(value, INTERNAL_URL_BASE);
    const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (parsed.origin !== INTERNAL_URL_BASE) return null;
    if (!normalized.startsWith("/") || normalized.startsWith("//")) return null;
    return normalized;
  } catch {
    return null;
  }
}

/**
 * Converts an untrusted login callback into a canonical same-origin path.
 * Only root-relative paths within this storefront are accepted; URL schemes,
 * protocol-relative URLs and ambiguous path separators fail closed.
 */
export function safeLoginCallbackPath(value: string | null): string {
  return canonicalInternalPath(value) ?? "/";
}

/**
 * Canonical same-origin destination for administrator-authored links, such as
 * a section button. Same rules as the login callback, plus a bare fragment
 * (`#kako-nastaje`) for links inside the current page.
 *
 * Returns `null` instead of a fallback: a link that cannot be trusted is not
 * rendered at all, rather than silently pointing at the home page.
 */
export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (FRAGMENT_ONLY.test(value)) return value;
  return canonicalInternalPath(value);
}

/**
 * Canonical absolute destination for administrator-authored links. Only
 * `http:` and `https:` are accepted; `javascript:`, `data:` and every other
 * scheme fail closed.
 */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value !== value.trim() || value.length === 0) return null;
  if (CONTROL_OR_BACKSLASH.test(value)) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Accepts either form of administrator-authored link and returns the value to
 * put in `href`, or `null` when nothing safe can be derived.
 */
export function safeLinkTarget(value: unknown): string | null {
  return safeInternalPath(value) ?? safeExternalUrl(value);
}
