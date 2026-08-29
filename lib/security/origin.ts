type HeaderReader = Pick<Headers, "get">;

/**
 * Browser write requests must either carry a matching Origin header or an
 * unforgeable same-origin Fetch Metadata signal. Provider callbacks are
 * exempted by the caller before this check.
 */
export function isTrustedWriteRequest(headers: HeaderReader): boolean {
  const host = headers.get("host")?.trim().toLowerCase();
  if (!host) return false;

  const origin = headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase() === host;
    } catch {
      return false;
    }
  }

  return headers.get("sec-fetch-site")?.toLowerCase() === "same-origin";
}
