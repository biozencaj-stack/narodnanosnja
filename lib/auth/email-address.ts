export const MAX_EMAIL_ADDRESS_LENGTH = 254;
export const MAX_EMAIL_LOCAL_PART_LENGTH = 64;

// Deliberately exclude display-name, group and address-list metacharacters.
// Auth mail is always addressed to exactly one mailbox, never a Nodemailer
// free-form address expression.
const EMAIL_ADDRESS_PATTERN =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

/**
 * Canonicalizes an email address at every public account boundary.
 *
 * The application has historically stored lower-case addresses in the unique
 * `User.email` column, so this function deliberately keeps that compatibility
 * contract. It never coerces non-string input and caps the value before a
 * database lookup or password hash can be triggered.
 */
export function normalizeEmailAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  const separatorIndex = normalized.indexOf("@");
  if (
    !normalized ||
    normalized.length > MAX_EMAIL_ADDRESS_LENGTH ||
    separatorIndex > MAX_EMAIL_LOCAL_PART_LENGTH ||
    !EMAIL_ADDRESS_PATTERN.test(normalized)
  ) {
    return null;
  }

  return normalized;
}
