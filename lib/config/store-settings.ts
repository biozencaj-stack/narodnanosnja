import "server-only";

import { getCachedSettings } from "@/lib/db/cache";
import {
  allowedStoreSettingKeys,
  builtInStoreSettings,
  type StoreSettingsMap,
} from "./store-settings-schema";
import {
  storeIdentityFromSettings,
  type StoreIdentity,
} from "./store-identity";

function environmentDefaults(): StoreSettingsMap {
  const shippingCost = Number(process.env.SHIPPING_COST ?? process.env.NEXT_PUBLIC_SHIPPING_COST);
  const freeShippingThreshold = Number(
    process.env.FREE_SHIPPING_THRESHOLD ?? process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD,
  );
  const minimumOrderSubtotal = Number(process.env.MINIMUM_ORDER_SUBTOTAL);
  return {
    "store.name": process.env.NEXT_PUBLIC_STORE_NAME || builtInStoreSettings["store.name"],
    "store.tagline": process.env.NEXT_PUBLIC_STORE_TAGLINE || builtInStoreSettings["store.tagline"],
    "store.description": process.env.NEXT_PUBLIC_STORE_DESCRIPTION || builtInStoreSettings["store.description"],
    "contact.email": process.env.NEXT_PUBLIC_STORE_EMAIL || builtInStoreSettings["contact.email"],
    "contact.phone": process.env.NEXT_PUBLIC_STORE_PHONE || "",
    "contact.address": process.env.NEXT_PUBLIC_STORE_ADDRESS || "",
    "contact.city": process.env.NEXT_PUBLIC_STORE_CITY || "",
    "social.instagram": process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
    "social.facebook": process.env.NEXT_PUBLIC_FACEBOOK_URL || "",
    "business.hours": process.env.NEXT_PUBLIC_BUSINESS_HOURS || builtInStoreSettings["business.hours"],
    "shipping.cost": Number.isFinite(shippingCost) && shippingCost >= 0
      ? String(shippingCost)
      : builtInStoreSettings["shipping.cost"],
    "shipping.freeThreshold": Number.isFinite(freeShippingThreshold) && freeShippingThreshold >= 0
      ? String(freeShippingThreshold)
      : builtInStoreSettings["shipping.freeThreshold"],
    "orders.minimumSubtotal": Number.isFinite(minimumOrderSubtotal) && minimumOrderSubtotal >= 0
      ? String(minimumOrderSubtotal)
      : builtInStoreSettings["orders.minimumSubtotal"],
    "seo.title": process.env.NEXT_PUBLIC_SEO_TITLE || builtInStoreSettings["seo.title"],
    "seo.description": process.env.NEXT_PUBLIC_SEO_DESCRIPTION || builtInStoreSettings["seo.description"],
  };
}

function nonNegativeNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export interface StoreCommerceSettings {
  shippingCost: number;
  freeShippingThreshold: number;
  minimumOrderSubtotal: number;
}

export async function getStoreCommerceSettings(): Promise<StoreCommerceSettings> {
  const settings = await getStoreSettings();
  return {
    shippingCost: nonNegativeNumber(settings["shipping.cost"], 0),
    freeShippingThreshold: nonNegativeNumber(
      settings["shipping.freeThreshold"],
      999999999,
    ),
    minimumOrderSubtotal: nonNegativeNumber(settings["orders.minimumSubtotal"], 0),
  };
}

export async function getStoreSettings(): Promise<StoreSettingsMap> {
  let databaseSettings: Record<string, string> = {};
  try {
    databaseSettings = await getCachedSettings();
  } catch (error) {
    console.warn("Store settings: database unavailable, using safe defaults", error);
  }

  const filtered = Object.fromEntries(
    Object.entries(databaseSettings).filter(([key]) => allowedStoreSettingKeys.has(key)),
  );
  return {
    ...builtInStoreSettings,
    ...environmentDefaults(),
    ...filtered,
  };
}

export async function getStoreIdentity(): Promise<StoreIdentity> {
  return storeIdentityFromSettings(await getStoreSettings());
}

export function storeThemeStyle(settings: StoreSettingsMap): Record<string, string> {
  return {
    "--color-primary": settings["theme.primary"],
    "--color-primary-hover": settings["theme.primaryHover"],
    "--color-zlatna": settings["theme.accent"],
    "--color-background": settings["theme.background"],
    "--color-background-alt": settings["theme.backgroundAlt"],
    "--color-povrsina": settings["theme.surface"],
    "--color-text": settings["theme.text"],
    "--color-text-muted": settings["theme.textMuted"],
    "--color-border": settings["theme.border"],
  };
}
