/**
 * Funkcionalnosti prodavnice koje smeju da se prikažu kupcu. Tajne i
 * kredencijali ostaju server-only; ovde su samo javni feature flagovi.
 */
export const storeCapabilities = {
  cashOnDelivery: process.env.NEXT_PUBLIC_CASH_ON_DELIVERY_ENABLED !== "false",
  cardPayments: process.env.NEXT_PUBLIC_CARD_PAYMENTS_ENABLED === "true",
  storeLocations: process.env.NEXT_PUBLIC_STORE_LOCATIONS_ENABLED === "true",
  careers: process.env.NEXT_PUBLIC_CAREERS_ENABLED === "true",
  reviews: process.env.NEXT_PUBLIC_REVIEWS_ENABLED !== "false",
  wishlist: process.env.NEXT_PUBLIC_WISHLIST_ENABLED !== "false",
  newsletter: process.env.NEXT_PUBLIC_NEWSLETTER_ENABLED !== "false",
  chat: process.env.NEXT_PUBLIC_CHAT_ENABLED !== "false",
  englishLocale: process.env.NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED === "true",
} as const;

export const complaintFormUrl =
  process.env.NEXT_PUBLIC_COMPLAINT_FORM_URL || "";
