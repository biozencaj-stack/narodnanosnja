/**
 * Format a number with dots as thousand separators (Serbian format)
 * Example: 12500 -> "12.500"
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('sr-RS').format(Math.round(price));
}

/**
 * Format price with currency
 * Example: 12500 -> "12.500 RSD"
 */
export function formatPriceWithCurrency(price: number, currency: string = 'RSD'): string {
  return `${formatPrice(price)} ${currency}`;
}

/**
 * Calculate discount percentage
 */
export function calculateDiscountPercentage(originalPrice: number, discountedPrice: number): number {
  if (originalPrice <= 0) return 0;
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
}

/**
 * Calculate discounted price based on percentage
 */
export function calculateDiscountedPrice(originalPrice: number, discountPercent: number): number {
  if (discountPercent <= 0 || discountPercent >= 100) return originalPrice;
  return Math.round(originalPrice * (1 - discountPercent / 100));
}

/**
 * Čišćenje specijalnih karaktera i sufiksa iz naziva proizvoda.
 * Uklanja: €, #, $, %, *, & i razne skraćenice (z.c., m.p.c., m.c., itd.)
 *
 * @param productName Naziv proizvoda
 * @returns Očišćen naziv proizvoda
 */
export function clearProductSufix(productName: string): string {
  if (!productName) return '';

  const patternsToRemove = [
    /z\.c\./gi,
    /m\.p\.c\./gi,
    /\$/g,
    /#/g,
    /%/g,
    /m\.c\./gi,
    /€/g,
    /\*/g,
    /z\.p\.c\./gi,
    /z\.s\./gi,
    /m\.p\./gi,
    /m\.cz\./gi,
    /&/g,
    /1$/,
  ];

  let cleaned = productName;
  patternsToRemove.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, '');
  });

  return cleaned.trim();
}
