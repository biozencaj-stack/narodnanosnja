/**
 * Central store/brand configuration from environment variables.
 * Use these values instead of literal [COMPANY_NAME], [STORE_CITY], etc.
 */

export const storeName =
  process.env.NEXT_PUBLIC_STORE_NAME || "My Store";

export const storeCity =
  process.env.NEXT_PUBLIC_STORE_CITY || "";

export const storeAddress =
  process.env.NEXT_PUBLIC_STORE_ADDRESS || "";

export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const storeEmail =
  process.env.SMTP_SERVER_USERNAME ||
  process.env.EMAIL_FROM ||
  "info@example.com";

export const storePhone = process.env.NEXT_PUBLIC_STORE_PHONE || "";

export const storeDescription =
  process.env.NEXT_PUBLIC_STORE_DESCRIPTION ||
  "Online prodavnica kvalitetnih proizvoda.";

/** Instagram URL (full profile URL). If not set, social link can be hidden or use placeholder. */
export const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_URL || "";

/** Facebook URL (full profile URL). If not set, social link can be hidden or use placeholder. */
export const facebookUrl = process.env.NEXT_PUBLIC_FACEBOOK_URL || "";
