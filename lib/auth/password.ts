import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt with 12 rounds
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
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

/**
 * Generate a secure random token for password reset
 */
export function generateResetToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}
