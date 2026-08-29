export type StoreSettingInputType =
  | "text"
  | "email"
  | "url"
  | "textarea"
  | "color"
  | "number";

export interface StoreSettingField {
  key: string;
  group: "general" | "contact" | "appearance" | "operations" | "seo";
  label: string;
  description?: string;
  type: StoreSettingInputType;
  required?: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
}

export const storeSettingFields: StoreSettingField[] = [
  { key: "store.name", group: "general", label: "Naziv prodavnice", type: "text", required: true, maxLength: 100 },
  { key: "store.tagline", group: "general", label: "Kratak slogan", type: "text", maxLength: 120 },
  { key: "store.description", group: "general", label: "Opis prodavnice", type: "textarea", maxLength: 500 },
  { key: "contact.email", group: "contact", label: "Javni email", type: "email", required: true, maxLength: 320 },
  { key: "contact.phone", group: "contact", label: "Telefon", type: "text", maxLength: 60 },
  { key: "contact.address", group: "contact", label: "Adresa", type: "text", maxLength: 200 },
  { key: "contact.city", group: "contact", label: "Grad", type: "text", maxLength: 100 },
  { key: "social.instagram", group: "contact", label: "Instagram URL", type: "url", maxLength: 500 },
  { key: "social.facebook", group: "contact", label: "Facebook URL", type: "url", maxLength: 500 },
  { key: "business.hours", group: "operations", label: "Radno vreme", description: "Prikazuje se uz kontakt podatke u podnožju", type: "text", maxLength: 120 },
  { key: "shipping.cost", group: "operations", label: "Cena standardne dostave (RSD)", description: "Obračunava se isključivo na serveru", type: "number", required: true, min: 0, max: 100000, step: 1 },
  { key: "shipping.freeThreshold", group: "operations", label: "Besplatna dostava od (RSD)", description: "Postavite veoma visok iznos ako besplatna dostava nije dostupna", type: "number", required: true, min: 0, max: 1000000000, step: 1 },
  { key: "orders.minimumSubtotal", group: "operations", label: "Minimalna vrednost porudžbine (RSD)", description: "0 znači da minimalni iznos nije ograničen", type: "number", required: true, min: 0, max: 100000000, step: 1 },
  { key: "theme.primary", group: "appearance", label: "Primarna boja", description: "Dugmad, aktivne veze i najvažnije akcije", type: "color", required: true },
  { key: "theme.primaryHover", group: "appearance", label: "Primarna — hover", type: "color", required: true },
  { key: "theme.accent", group: "appearance", label: "Akcentna boja", description: "Detalji, oznake i dekorativni elementi", type: "color", required: true },
  { key: "theme.background", group: "appearance", label: "Osnovna pozadina", type: "color", required: true },
  { key: "theme.backgroundAlt", group: "appearance", label: "Alternativna pozadina", type: "color", required: true },
  { key: "theme.surface", group: "appearance", label: "Kartice i površine", type: "color", required: true },
  { key: "theme.text", group: "appearance", label: "Glavni tekst", type: "color", required: true },
  { key: "theme.textMuted", group: "appearance", label: "Prigušeni tekst", type: "color", required: true },
  { key: "theme.border", group: "appearance", label: "Ivice i razdelnici", type: "color", required: true },
  { key: "seo.title", group: "seo", label: "Podrazumevani SEO naslov", type: "text", maxLength: 70 },
  { key: "seo.description", group: "seo", label: "Podrazumevani SEO opis", type: "textarea", maxLength: 170 },
];

export type StoreSettingsMap = Record<string, string>;

export const builtInStoreSettings: StoreSettingsMap = {
  "store.name": "Народна ношња",
  "store.tagline": "ručno tkano",
  "store.description": "Ručno tkani proizvodi, nastali od prirodnih materijala i šara koje se prenose generacijama.",
  "contact.email": "info@example.com",
  "contact.phone": "",
  "contact.address": "",
  "contact.city": "",
  "social.instagram": "",
  "social.facebook": "",
  "business.hours": "Pon - Pet: 09:00 - 17:00",
  "shipping.cost": "0",
  "shipping.freeThreshold": "999999999",
  "orders.minimumSubtotal": "0",
  "theme.primary": "#a4161a",
  "theme.primaryHover": "#8c1c13",
  "theme.accent": "#b98f21",
  "theme.background": "#faf6ed",
  "theme.backgroundAlt": "#f2ead9",
  "theme.surface": "#fffdf6",
  "theme.text": "#2c231b",
  "theme.textMuted": "#6d5c4a",
  "theme.border": "#ded0b6",
  "seo.title": "Народна ношња — ručno tkani proizvodi",
  "seo.description": "Ručno tkani šalovi, tkanice, torbe i delovi narodne nošnje, sa dostavom širom Srbije.",
};

export const allowedStoreSettingKeys = new Set(
  storeSettingFields.map((field) => field.key),
);

export function validateStoreSetting(
  field: StoreSettingField,
  rawValue: unknown,
): string | null {
  if (typeof rawValue !== "string") return "Vrednost mora biti tekst";
  const value = rawValue.trim();
  if (field.required && !value) return "Polje je obavezno";
  if (field.maxLength && value.length > field.maxLength) {
    return `Najviše ${field.maxLength} karaktera`;
  }
  if (field.type === "color" && !/^#[0-9a-f]{6}$/i.test(value)) {
    return "Boja mora biti u HEX formatu, npr. #a4161a";
  }
  if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Email adresa nije ispravna";
  }
  if (field.type === "number") {
    const number = Number(value);
    if (!value || !Number.isFinite(number)) return "Unesite ispravan broj";
    if (field.min !== undefined && number < field.min) return `Najmanja vrednost je ${field.min}`;
    if (field.max !== undefined && number > field.max) return `Najveća vrednost je ${field.max}`;
  }
  if (field.type === "url" && value) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) return "URL mora koristiti http ili https";
    } catch {
      return "URL nije ispravan";
    }
  }
  return null;
}

function hexToRgb(value: unknown): [number, number, number] | null {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  return [
    Number.parseInt(value.slice(1, 3), 16),
    Number.parseInt(value.slice(3, 5), 16),
    Number.parseInt(value.slice(5, 7), 16),
  ];
}

function relativeLuminance(value: unknown): number | null {
  const rgb = hexToRgb(value);
  if (!rgb) return null;
  const [red, green, blue] = rgb.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function colorContrastRatio(first: unknown, second: unknown): number | null {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  if (firstLuminance === null || secondLuminance === null) return null;
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Cross-field checks for color combinations that are used for normal-sized
 * text throughout the storefront. Individual HEX validation runs separately.
 */
export function validateStoreThemeContrast(
  settings: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const minimumTextContrast = 4.5;
  const surfaces = [settings["theme.background"], settings["theme.surface"]];

  const textRatios = surfaces.map((surface) =>
    colorContrastRatio(settings["theme.text"], surface),
  );
  if (textRatios.some((ratio) => ratio !== null && ratio < minimumTextContrast)) {
    errors["theme.text"] =
      "Glavni tekst mora imati kontrast najmanje 4.5:1 prema pozadini i karticama";
  }

  const mutedTextRatios = surfaces.map((surface) =>
    colorContrastRatio(settings["theme.textMuted"], surface),
  );
  if (mutedTextRatios.some((ratio) => ratio !== null && ratio < minimumTextContrast)) {
    errors["theme.textMuted"] =
      "Prigušeni tekst mora imati kontrast najmanje 4.5:1 prema pozadini i karticama";
  }

  const primaryContrast = colorContrastRatio("#ffffff", settings["theme.primary"]);
  if (primaryContrast !== null && primaryContrast < minimumTextContrast) {
    errors["theme.primary"] =
      "Primarna boja mora imati kontrast najmanje 4.5:1 prema belom tekstu na dugmadima";
  }

  const primaryHoverContrast = colorContrastRatio(
    "#ffffff",
    settings["theme.primaryHover"],
  );
  if (primaryHoverContrast !== null && primaryHoverContrast < minimumTextContrast) {
    errors["theme.primaryHover"] =
      "Hover boja mora imati kontrast najmanje 4.5:1 prema belom tekstu na dugmadima";
  }

  return errors;
}
