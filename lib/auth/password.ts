import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;
export const MAX_BCRYPT_PASSWORD_BYTES = 72;

/** Bcrypt ignores input after 72 bytes, so longer values must be rejected. */
export function isBcryptSafePassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    new TextEncoder().encode(value).byteLength <= MAX_BCRYPT_PASSWORD_BYTES
  );
}

/**
 * Hash a password using bcrypt with 12 rounds
 */
export async function hashPassword(password: string): Promise<string> {
  if (!isBcryptSafePassword(password)) {
    throw new Error("Password exceeds bcrypt byte limit");
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  if (!isBcryptSafePassword(password)) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Validate password requirements
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one number
 * - At least one special character
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!isBcryptSafePassword(password)) {
    errors.push("Lozinka ne sme biti duža od 72 bajta");
  }

  if (password.length < 8) {
    errors.push("Lozinka mora imati minimum 8 karaktera");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Lozinka mora sadržati bar jedno veliko slovo");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Lozinka mora sadržati bar jedan broj");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Lozinka mora sadržati bar jedan specijalni karakter");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
