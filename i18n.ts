/**
 * i18n Configuration
 *
 * Simple i18n setup using JSON message files.
 * The active locale is determined by the NEXT_PUBLIC_LOCALE environment variable.
 *
 * To add a new language:
 * 1. Create messages/{locale}.json (e.g., messages/de.json)
 * 2. Set NEXT_PUBLIC_LOCALE={locale} in .env
 * 3. Restart the application
 *
 * For more advanced i18n (URL-based routing, middleware), consider next-intl.
 */

import sr from "./messages/sr.json";
import en from "./messages/en.json";

const messages: Record<
  string,
  Record<string, Record<string, string | Record<string, string>>>
> = {
  sr,
  en,
};

/**
 * Get the current locale
 */
export function getLocale(): string {
  return process.env.NEXT_PUBLIC_LOCALE || "sr";
}

/**
 * Get all messages for the current locale
 */
export function getMessages() {
  const locale = getLocale();
  return messages[locale] || messages.sr;
}

/**
 * Translation function - get a translated string by dot-notation key
 * Example: t("product.addToCart") => "Dodaj u korpu"
 */
export function t(key: string): string {
  const locale = getLocale();
  const msgs = messages[locale] || messages.sr;

  const parts = key.split(".");
  let result: unknown = msgs;

  for (const part of parts) {
    if (result && typeof result === "object" && part in result) {
      result = (result as Record<string, unknown>)[part];
    } else {
      // Fallback to Serbian
      result = msgs;
      for (const p of parts) {
        if (result && typeof result === "object" && p in result) {
          result = (result as Record<string, unknown>)[p];
        } else {
          return key; // Return key if not found
        }
      }
      break;
    }
  }

  return typeof result === "string" ? result : key;
}

/**
 * Available locales
 */
export const locales = ["sr", "en"] as const;
export type Locale = (typeof locales)[number];
