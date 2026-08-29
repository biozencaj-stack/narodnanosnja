/**
 * Convert image source to a usable URL for img/Image src
 * Handles both:
 * - Local file paths (/uploads/products/...) - returned as-is
 * - Base64 strings - converted to data URI
 */
export function toImageDataUri(src: string | null | undefined): string {
  if (!src) return '';
  // If it starts with / or http, it's already a valid URL/path
  if (src.startsWith('/') || src.startsWith('http')) return src;
  // Otherwise treat as base64
  return `data:image/jpeg;base64,${src}`;
}
