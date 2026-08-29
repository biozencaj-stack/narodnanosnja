/**
 * Validation utilities for form fields
 */

/**
 * Validate email address format
 *
 * @param email - Email address to validate
 * @returns true if valid email format
 */
export function validateEmailAddress(email: string): boolean {
  const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return pattern.test(email);
}

/**
 * Validate Serbian postal code (5 digits starting with 1, 2, or 3)
 *
 * @param postalCode - Postal code to validate
 * @returns true if valid Serbian postal code
 */
export function validateSerbianPostal(postalCode: string): boolean {
  // Serbian postal codes are 5 digits starting with 1, 2, or 3
  const postalCodePattern = /^[1-3]\d{4}$/;
  return postalCodePattern.test(postalCode);
}

/**
 * Validate phone number format
 * Accepts: 0631234567, +381631234567, 381631234567, 063 123 4567
 *
 * @param tel - Phone number to validate
 * @returns true if valid phone number format
 */
export function validatePhoneFormat(tel: string): boolean {
  // Remove spaces, dashes, and parentheses
  const cleaned = tel.replace(/[\s\-()]/g, '');

  // Accept formats:
  // - 0631234567 (local, 9-10 digits starting with 0)
  // - +381631234567 (international with +)
  // - 381631234567 (international without +)
  const phonePattern = /^(\+?381|0)[0-9]{8,10}$/;
  return phonePattern.test(cleaned);
}

/**
 * Check if a field is empty
 *
 * @param fieldValue - Value to check
 * @returns true if empty or only whitespace
 */
export function isFieldBlank(fieldValue: string): boolean {
  return fieldValue.trim() === '';
}
