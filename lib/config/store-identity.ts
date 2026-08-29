import type { StoreSettingsMap } from "./store-settings-schema";

/**
 * Public store identity that is safe to serialize into client components.
 * Operational secrets and commerce rules intentionally do not belong here.
 */
export interface StoreIdentity {
  name: string;
  tagline: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  instagramUrl: string;
  facebookUrl: string;
  businessHours: string;
}

export function storeIdentityFromSettings(
  settings: StoreSettingsMap,
): StoreIdentity {
  return {
    name: settings["store.name"],
    tagline: settings["store.tagline"],
    description: settings["store.description"],
    email: settings["contact.email"],
    phone: settings["contact.phone"],
    address: settings["contact.address"],
    city: settings["contact.city"],
    instagramUrl: settings["social.instagram"],
    facebookUrl: settings["social.facebook"],
    businessHours: settings["business.hours"],
  };
}
