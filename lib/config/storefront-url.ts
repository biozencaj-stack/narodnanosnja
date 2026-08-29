import "server-only";

/**
 * Canonical storefront URL is deployment configuration, not editable store
 * content. Keeping it outside the settings table prevents accidental domain
 * changes from the admin UI.
 */
export function getStorefrontUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_SITE_URL mora biti podešen na javni HTTPS URL u produkciji",
      );
    }
    return new URL("http://localhost:3000");
  }

  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL nije validan apsolutni URL");
  }

  const isLocalHost = ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(
    url.hostname,
  );
  if (process.env.NODE_ENV === "production" && (url.protocol !== "https:" || isLocalHost)) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL mora biti javni HTTPS URL u produkciji",
    );
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("NEXT_PUBLIC_SITE_URL mora koristiti http ili https");
  }

  return url;
}
